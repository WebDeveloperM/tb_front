import { forwardRef, useEffect, useMemo, useState, Fragment } from 'react';
import Breadcrumb from '../../components/Breadcrumbs/Breadcrumb';
import axioss from '../../api/axios';
import { BASE_URL } from '../../utils/urls';
import { toast } from 'react-toastify';
import { FaRegCalendarAlt, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

type StatisticsRow = {
  product_id: number;
  product_name: string;
  arrived: number;
  issued: number;
  remaining: number;
};

type StatisticsResponse = {
  date_from: string;
  date_to: string;
  totals: {
    arrived: number;
    issued: number;
    remaining: number;
  };
  rows: StatisticsRow[];
};

type ArrivalRow = {
  id: number;
  ppeproduct: number;
  ppeproduct_name: string;
  quantity: number;
  size?: string | null;
  size_breakdown?: Record<string, number>;
  size_display?: string;
  received_at: string;
  accepted_by?: string | null;
};

type ExpandedArrivalRow = {
  key: string;
  ppeproduct_name: string;
  quantity: number | string;
  size: string;
  received_at: string;
  accepted_by?: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}.${month}.${year}`;
};

const normalizeDate = (value?: string | null) => {
  if (!value) return '';
  return String(value).slice(0, 10);
};

const expandArrivalRowBySize = (row: ArrivalRow): ExpandedArrivalRow[] => {
  const fromBreakdown = row.size_breakdown && typeof row.size_breakdown === 'object'
    ? Object.entries(row.size_breakdown)
    : [];

  if (fromBreakdown.length > 0) {
    return fromBreakdown.map(([sizeKey, qty], index) => ({
      key: `${row.id}-${sizeKey}-${index}`,
      ppeproduct_name: row.ppeproduct_name,
      quantity: Number(qty) || 0,
      size: sizeKey,
      received_at: row.received_at,
      accepted_by: row.accepted_by,
    }));
  }

  const sizeDisplay = String(row.size_display || '').trim();
  if (sizeDisplay.includes('=')) {
    const parsedPairs = sizeDisplay
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [sizeKey, qtyRaw] = part.split('=').map((piece) => (piece || '').trim());
        return { sizeKey, qtyRaw };
      })
      .filter((pair) => pair.sizeKey);

    if (parsedPairs.length > 0) {
      return parsedPairs.map((pair, index) => ({
        key: `${row.id}-${pair.sizeKey}-${index}`,
        ppeproduct_name: row.ppeproduct_name,
        quantity: Number(pair.qtyRaw) || pair.qtyRaw || 0,
        size: pair.sizeKey,
        received_at: row.received_at,
        accepted_by: row.accepted_by,
      }));
    }
  }

  return [{
    key: `${row.id}-base`,
    ppeproduct_name: row.ppeproduct_name,
    quantity: row.quantity,
    size: String(row.size || row.size_display || '-'),
    received_at: row.received_at,
    accepted_by: row.accepted_by,
  }];
};

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DateInput = forwardRef<HTMLInputElement, { value?: string; onClick?: () => void; placeholder?: string }>(
  ({ value, onClick, placeholder }, ref) => (
    <div className="relative">
      <input
        ref={ref}
        type="text"
        value={value ?? ''}
        onClick={onClick}
        readOnly
        placeholder={placeholder}
        className="w-full rounded border px-3 py-2 pr-10"
      />
      <button
        type="button"
        onClick={onClick}
        className="absolute inset-y-0 right-3 flex items-center text-slate-500"
        aria-label="Открыть календарь"
      >
        <FaRegCalendarAlt />
      </button>
    </div>
  ),
);

DateInput.displayName = 'DateInput';

const StatisticsPage = () => {
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');
  const [arrivalProductFilter, setArrivalProductFilter] = useState('');
  const [arrivalSizeFilter, setArrivalSizeFilter] = useState('');
  const [stats, setStats] = useState<StatisticsResponse | null>(null);
  const [arrivals, setArrivals] = useState<ArrivalRow[]>([]);
  
  // Filters for main statistics table
  const [productFilter, setProductFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  
  // Expanded groups state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const fetchStats = async (range?: { from: string; to: string }) => {
    try {
      setLoading(true);
      const effectiveFrom = range ? range.from : appliedFromDate;
      const effectiveTo = range ? range.to : appliedToDate;
      const params = new URLSearchParams();
      if (effectiveFrom) params.append('from', effectiveFrom);
      if (effectiveTo) params.append('to', effectiveTo);

      const query = params.toString();
      const url = query ? `${BASE_URL}/statistics/ppe/?${query}` : `${BASE_URL}/statistics/ppe/`;
      const [statsResponse, arrivalsResponse] = await Promise.all([
        axioss.get(url),
        axioss.get(`${BASE_URL}/ppe-arrivals/`),
      ]);

      setStats(statsResponse.data as StatisticsResponse);

      const arrivalsData = Array.isArray(arrivalsResponse.data) ? arrivalsResponse.data : [];
      setArrivals(arrivalsData as ArrivalRow[]);
    } catch (error: any) {
      const backendError = error?.response?.data?.error;
      toast.error(backendError || 'Ошибка при загрузке статистики');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    const nextRange = {
      from: fromDate ? toDateInput(fromDate) : '',
      to: toDate ? toDateInput(toDate) : '',
    };
    setAppliedFromDate(nextRange.from);
    setAppliedToDate(nextRange.to);
    fetchStats(nextRange);
  }, [fromDate, toDate]);

  const rows = useMemo(() => stats?.rows ?? [], [stats]);

  // Extract unique product base names (without size) for filter dropdown
  const productOptions = useMemo(() => {
    const baseNames = rows.map((row) => {
      // Extract base name before "(Размер" or just use full name
      const match = row.product_name.match(/^(.+?)\s*\(Размер/);
      return match ? match[1].trim() : row.product_name;
    });
    return Array.from(new Set(baseNames)).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [rows]);

  // Filter rows based on selected filters
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Filter by product base name
      if (productFilter) {
        const match = row.product_name.match(/^(.+?)\s*\(Размер/);
        const baseName = match ? match[1].trim() : row.product_name;
        if (baseName.toLowerCase() !== productFilter.toLowerCase()) return false;
      }
      
      // Filter by size
      if (sizeFilter) {
        const sizeMatch = row.product_name.match(/\(Размер\s*([^)]+)\)/i);
        const size = sizeMatch ? sizeMatch[1].trim().toLowerCase() : '';
        if (!size.includes(sizeFilter.toLowerCase())) return false;
      }
      
      return true;
    });
  }, [rows, productFilter, sizeFilter]);

  // Group filtered rows by base product name
  type GroupedProduct = {
    baseName: string;
    rows: StatisticsRow[];
    totals: { arrived: number; issued: number; remaining: number };
  };

  const groupedProducts = useMemo(() => {
    const groups = new Map<string, GroupedProduct>();
    
    filteredRows.forEach((row) => {
      const match = row.product_name.match(/^(.+?)\s*\(Размер/);
      const baseName = match ? match[1].trim() : row.product_name;
      
      if (!groups.has(baseName)) {
        groups.set(baseName, {
          baseName,
          rows: [],
          totals: { arrived: 0, issued: 0, remaining: 0 },
        });
      }
      
      const group = groups.get(baseName)!;
      group.rows.push(row);
      group.totals.arrived += row.arrived;
      group.totals.issued += row.issued;
      group.totals.remaining += row.remaining;
    });
    
    return Array.from(groups.values()).sort((a, b) => a.baseName.localeCompare(b.baseName, 'ru'));
  }, [filteredRows]);

  const toggleGroup = (baseName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(baseName)) {
        next.delete(baseName);
      } else {
        next.add(baseName);
      }
      return next;
    });
  };

  const expandAllGroups = () => {
    setExpandedGroups(new Set(groupedProducts.map((g) => g.baseName)));
  };

  const collapseAllGroups = () => {
    setExpandedGroups(new Set());
  };

  const arrivalProductOptions = useMemo(() => {
    return Array.from(new Set(
      arrivals
        .map((row) => String(row.ppeproduct_name || '').trim())
        .filter(Boolean),
    )).sort((left, right) => left.localeCompare(right, 'ru'));
  }, [arrivals]);

  const filteredArrivals = useMemo(() => {
    const productFilter = arrivalProductFilter.trim().toLowerCase();

    return arrivals.filter((row) => {
      const receivedDate = normalizeDate(row.received_at);
      if (!receivedDate) return false;
      if (appliedFromDate && receivedDate < appliedFromDate) return false;
      if (appliedToDate && receivedDate > appliedToDate) return false;

      const productName = String(row.ppeproduct_name || '').toLowerCase();

      if (productFilter && !productName.includes(productFilter)) return false;

      return true;
    });
  }, [arrivals, appliedFromDate, appliedToDate, arrivalProductFilter]);

  const expandedFilteredArrivals = useMemo(() => {
    const sizeFilter = arrivalSizeFilter.trim().toLowerCase();

    const expanded = filteredArrivals.flatMap(expandArrivalRowBySize);
    if (!sizeFilter) return expanded;

    return expanded.filter((row) => String(row.size || '').toLowerCase().includes(sizeFilter));
  }, [filteredArrivals, arrivalSizeFilter]);

  const groupedArrivals = useMemo(() => {
    const groups: Array<{ date: string; rows: ExpandedArrivalRow[] }> = [];
    const groupIndexByDate = new Map<string, number>();

    expandedFilteredArrivals.forEach((row) => {
      const dateKey = normalizeDate(row.received_at);
      const existingIndex = groupIndexByDate.get(dateKey);

      if (existingIndex === undefined) {
        groupIndexByDate.set(dateKey, groups.length);
        groups.push({ date: dateKey, rows: [row] });
        return;
      }

      groups[existingIndex].rows.push(row);
    });

    return groups;
  }, [expandedFilteredArrivals]);

  return (
    <>
      <Breadcrumb pageName="Статистика" />

      <div className="rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
        {/* Filters row */}
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          {/* Left side: Product and Size filters */}
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-end">
            <div className="md:w-48">
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="w-full rounded border border-stroke px-3 py-2"
              >
                <option value="">Все средства защиты</option>
                {productOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:w-48">
              <input
                type="text"
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
                placeholder="Фильтр по размеру"
                className="w-full rounded border border-stroke px-3 py-2"
              />
            </div>
            {(productFilter || sizeFilter) && (
              <button
                type="button"
                onClick={() => {
                  setProductFilter('');
                  setSizeFilter('');
                }}
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Сбросить
              </button>
            )}
          </div>

          {/* Right side: Date filters */}
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="md:w-48">
              <label className="mb-1 block text-sm font-medium">С даты</label>
              <DatePicker
                selected={fromDate}
                onChange={(date: Date | null) => setFromDate(date)}
                dateFormat="dd.MM.yyyy"
                placeholderText="dd.mm.yyyy"
                customInput={<DateInput placeholder="dd.mm.yyyy" />}
                isClearable
                wrapperClassName="statistics-date-filter"
              />
            </div>
            <div className="md:w-48">
              <label className="mb-1 block text-sm font-medium">По дату</label>
              <DatePicker
                selected={toDate}
                onChange={(date: Date | null) => setToDate(date)}
                dateFormat="dd.MM.yyyy"
                placeholderText="dd.mm.yyyy"
                customInput={<DateInput placeholder="dd.mm.yyyy" />}
                isClearable
                wrapperClassName="statistics-date-filter"
              />
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded border border-stroke p-4">
            <div className="text-sm text-slate-500">Поступило за период</div>
            <div className="text-2xl font-semibold">{stats?.totals?.arrived ?? 0}</div>
          </div>
          <div className="rounded border border-stroke p-4">
            <div className="text-sm text-slate-500">Выдано за период</div>
            <div className="text-2xl font-semibold">{stats?.totals?.issued ?? 0}</div>
          </div>
          <div className="rounded border border-stroke p-4">
            <div className="text-sm text-slate-500">Остаток на конец периода</div>
            <div className="text-2xl font-semibold">{stats?.totals?.remaining ?? 0}</div>
          </div>
        </div>

        {/* Expand/Collapse controls */}
        {groupedProducts.some((g) => g.rows.length > 1) && (
          <div className="mb-2 flex gap-2 justify-end">
            <button
              type="button"
              onClick={expandAllGroups}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Развернуть все
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={collapseAllGroups}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Свернуть все
            </button>
          </div>
        )}

        <div className="overflow-x-auto rounded border border-stroke">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stroke bg-slate-50 text-left">
                <th className="px-3 py-2 w-10">№</th>
                <th className="px-3 py-2">Средство защиты</th>
                <th className="px-3 py-2">Поступило</th>
                <th className="px-3 py-2">Выдано</th>
                <th className="px-3 py-2">Остаток</th>
              </tr>
            </thead>
            <tbody>
              {groupedProducts.length > 0 ? (
                groupedProducts.map((group, groupIndex) => {
                  const isExpanded = expandedGroups.has(group.baseName);
                  const hasMultipleSizes = group.rows.length > 1;
                  
                  return (
                    <Fragment key={`group-${group.baseName}`}>
                      {/* Group header row */}
                      <tr
                        className={`border-b border-stroke ${hasMultipleSizes ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                        onClick={() => hasMultipleSizes && toggleGroup(group.baseName)}
                      >
                        <td className="px-3 py-2">{groupIndex + 1}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {hasMultipleSizes && (
                              <span className="text-slate-400">
                                {isExpanded ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                              </span>
                            )}
                            <span className={hasMultipleSizes ? 'font-medium' : ''}>
                              {hasMultipleSizes ? group.baseName : group.rows[0].product_name}
                            </span>
                            {hasMultipleSizes && (
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                {group.rows.length} размер{group.rows.length > 4 ? 'ов' : group.rows.length > 1 ? 'а' : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">{group.totals.arrived}</td>
                        <td className="px-3 py-2">{group.totals.issued}</td>
                        <td className="px-3 py-2">{group.totals.remaining}</td>
                      </tr>
                      
                      {/* Expanded size rows */}
                      {hasMultipleSizes && isExpanded && group.rows.map((row, rowIndex) => {
                        const sizeMatch = row.product_name.match(/\(Размер\s*([^)]+)\)/i);
                        const size = sizeMatch ? sizeMatch[1].trim() : '-';
                        
                        return (
                          <tr
                            key={row.product_id}
                            className="border-b border-stroke bg-slate-50/50"
                          >
                            <td className="px-3 py-2 text-slate-400 text-xs">
                              {groupIndex + 1}.{rowIndex + 1}
                            </td>
                            <td className="px-3 py-2 pl-10">
                              <span className="text-slate-600">Размер {size}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-600">{row.arrived}</td>
                            <td className="px-3 py-2 text-slate-600">{row.issued}</td>
                            <td className="px-3 py-2 text-slate-600">{row.remaining}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                    Нет данных за выбранный период
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* <div className="mt-6">
          <h3 className="mb-3 text-base font-semibold">Прием поступивших СИЗ на склад</h3>
          <div className="mb-3 flex w-full flex-col gap-3 md:w-1/2 md:flex-row">
            <select
              value={arrivalProductFilter}
              onChange={(event) => setArrivalProductFilter(event.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">Все средства защиты</option>
              {arrivalProductOptions.map((productName) => (
                <option key={productName} value={productName}>
                  {productName}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={arrivalSizeFilter}
              onChange={(event) => setArrivalSizeFilter(event.target.value)}
              placeholder="Фильтр по размеру"
              className="w-full rounded border px-3 py-2"
            />
            <button
              type="button"
              onClick={() => {
                setArrivalProductFilter('');
                setArrivalSizeFilter('');
              }}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              disabled={!arrivalProductFilter.trim() && !arrivalSizeFilter.trim()}
            >
              Сбросить
            </button>
          </div>
          {groupedArrivals.length > 0 ? (
            <div className="space-y-3">
              {groupedArrivals.map((group, groupIndex) => (
                <div
                  key={`arrival-group-${group.date}-${groupIndex}`}
                  className="overflow-hidden rounded-md border border-stroke"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stroke bg-slate-50 px-4 py-2">
                    <div className="text-sm font-medium">Приемка #{groupedArrivals.length - groupIndex}</div>
                    <div className="text-xs text-slate-600">Дата приема: {formatDate(group.date)}</div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-stroke bg-slate-50 text-left">
                          <th className="px-3 py-2">№</th>
                          <th className="px-3 py-2">Средство защиты</th>
                          <th className="px-3 py-2">Количество</th>
                          <th className="px-3 py-2">Размер</th>
                          <th className="px-3 py-2">Дата приема</th>
                          <th className="px-3 py-2">Принял</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row, rowIndex) => (
                          <tr key={row.key} className="border-b border-stroke">
                            <td className="px-3 py-2">{rowIndex + 1}</td>
                            <td className="px-3 py-2">{row.size && row.size !== '-' ? `${row.ppeproduct_name} (Размер ${row.size})` : row.ppeproduct_name}</td>
                            <td className="px-3 py-2">{row.quantity}</td>
                            <td className="px-3 py-2">{row.size || '-'}</td>
                            <td className="px-3 py-2">{formatDate(row.received_at)}</td>
                            <td className="px-3 py-2">{row.accepted_by || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-stroke px-4 py-8 text-center text-gray-500">
              {loading ? 'Загрузка...' : 'По выбранному диапазону дата приема записи не найдены'}
            </div>
          )}
        </div> */}
      </div>
    </>
  );
};

export default StatisticsPage;
