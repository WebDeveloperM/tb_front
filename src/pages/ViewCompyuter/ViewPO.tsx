import { useEffect, useMemo, useRef, useState } from "react";
import axioss from "../../api/axios";
import { BASE_IMAGE_URL, BASE_URL } from "../../utils/urls";
import { Link, useParams } from "react-router-dom";
import { GrAddCircle } from "react-icons/gr";
import { FaRegCalendarAlt } from "react-icons/fa";
import { FaFileExcel } from "react-icons/fa";
import * as XLSX from 'xlsx-js-style';
import { toast } from 'react-toastify';

type PpeInfo = {
    id: number;
    name: string;
    size?: string | null;
    type_product: string | null;
    type_product_display?: string | null;
    renewal_months: number;
    is_new?: boolean | null;
};

type ItemDetail = {
    id?: number;
    issued_at?: string | null;
    issued_by_info?: {
        id: number;
        username: string;
        full_name: string;
    } | null;
    ppeproduct?: Array<number | { id: number; name?: string }>;
    ppeproduct_info?: PpeInfo[];
    employee?: {
        id?: number;
        first_name?: string;
        last_name?: string;
        surname?: string;
        tabel_number?: string;
        position?: string;
        department?: {
            name?: string;
            boss_fullName?: string;
        } | null;
        section?: {
            name?: string;
        } | null;
    };
    issue_history?: Array<{
        id: number;
        slug?: string | null;
        image?: string | null;
        issued_at?: string | null;
        next_due_date?: string | null;
        is_current?: boolean;
        issued_by_info?: {
            id: number;
            username: string;
            full_name: string;
        } | null;
        ppeproduct_info?: PpeInfo[];
    }>;
};

export default function ViewPO() {
    const [itemDetailData, setItemDetailData] = useState<ItemDetail | null>(null);
    const [previewImage, setPreviewImage] = useState<{ imageUrl: string; issuedAt?: string | null } | null>(null);
    const [issuedFromDate, setIssuedFromDate] = useState('');
    const [issuedToDate, setIssuedToDate] = useState('');
    const [productFilterId, setProductFilterId] = useState<number | ''>('');
    const [sizeFilter, setSizeFilter] = useState('');
    const issuedFromInputRef = useRef<HTMLInputElement | null>(null);
    const issuedToInputRef = useRef<HTMLInputElement | null>(null);
    const { slug } = useParams();
    const role = localStorage.getItem('role') || 'user';
    const canAddItem = role === 'admin' || role === 'warehouse_manager';

    const resolveImageUrl = (value?: string | null) => {
        if (!value) return '';
        if (String(value).startsWith('http://') || String(value).startsWith('https://')) {
            return String(value);
        }
        return `${BASE_IMAGE_URL}${value}`;
    };

    const formatDate = (value?: string | null) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    };

    const calculateNextIssueDate = (issuedAt?: string | null, renewalMonths?: number) => {
        if (!issuedAt || renewalMonths === undefined || renewalMonths === null) return '-';
        const date = new Date(issuedAt);
        if (Number.isNaN(date.getTime())) return '-';
        date.setMonth(date.getMonth() + renewalMonths);
        return formatDate(date.toISOString());
    };

    const historyGroups = (itemDetailData?.issue_history ?? []).filter(
        (issue) => (issue.ppeproduct_info ?? []).length > 0,
    );

    const historyGroupsWithMeta = useMemo(
        () => historyGroups.map((issue, index) => ({
            ...issue,
            displayNumber: historyGroups.length - index,
        })),
        [historyGroups],
    );

    const filteredHistoryGroups = useMemo(() => {
        if (!issuedFromDate && !issuedToDate) {
            return historyGroupsWithMeta;
        }

        const fromDate = issuedFromDate ? new Date(`${issuedFromDate}T00:00:00`) : null;
        const toDate = issuedToDate ? new Date(`${issuedToDate}T23:59:59`) : null;

        return historyGroupsWithMeta.filter((issue) => {
            if (!issue.issued_at) return false;
            const issuedAt = new Date(issue.issued_at);
            if (Number.isNaN(issuedAt.getTime())) return false;
            if (fromDate && issuedAt < fromDate) return false;
            if (toDate && issuedAt > toDate) return false;
            return true;
        });
    }, [historyGroupsWithMeta, issuedFromDate, issuedToDate]);

    const historyProductOptions = useMemo(() => {
        const map = new Map<number, string>();
        filteredHistoryGroups.forEach((issue) => {
            (issue.ppeproduct_info ?? []).forEach((product) => {
                if (product?.id == null || !product?.name) return;
                if (!map.has(product.id)) {
                    map.set(product.id, product.name);
                }
            });
        });

        return Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
    }, [filteredHistoryGroups]);

    const displayedHistoryGroups = useMemo(() => {
        const normalizedSize = sizeFilter.trim().toLowerCase();

        return filteredHistoryGroups
            .map((issue) => {
                const filteredProducts = (issue.ppeproduct_info ?? []).filter((product) => {
                    if (productFilterId && Number(product.id) !== Number(productFilterId)) {
                        return false;
                    }

                    if (!normalizedSize) {
                        return true;
                    }

                    const productSize = String(product.size || '').toLowerCase();
                    return productSize.includes(normalizedSize);
                });

                return {
                    ...issue,
                    ppeproduct_info: filteredProducts,
                };
            })
            .filter((issue) => (issue.ppeproduct_info ?? []).length > 0);
    }, [filteredHistoryGroups, productFilterId, sizeFilter]);

    const exportFilteredHistoryToExcel = () => {
        const employeeData = itemDetailData?.employee;
        const sortedForExport = [...displayedHistoryGroups].sort((left, right) => {
            const leftTime = left.issued_at ? new Date(left.issued_at).getTime() : Number.POSITIVE_INFINITY;
            const rightTime = right.issued_at ? new Date(right.issued_at).getTime() : Number.POSITIVE_INFINITY;
            return leftTime - rightTime;
        });

        const headers = [
            '№',
            'Фамилия',
            'Имя',
            'Отчество',
            'Табельный номер',
            'Должность',
            'Цех',
            'Отдел',
            'Руководитель цеха',
            'Выдача',
            'Наименование',
            'Размер',
            'Ед. изм.',
            'Срок обновления (мес.)',
            'Дата выдачи',
            'Следующая выдача',
            'Подтверждено',
        ];

        const rawRows = sortedForExport.flatMap((issue) =>
            (issue.ppeproduct_info ?? []).map((product) => ([
                employeeData?.last_name || '-',
                employeeData?.first_name || '-',
                employeeData?.surname || '-',
                employeeData?.tabel_number || '-',
                employeeData?.position || '-',
                employeeData?.department?.name || '-',
                employeeData?.section?.name || '-',
                employeeData?.department?.boss_fullName || '-',
                `#${issue.displayNumber}`,
                product.name || '-',
                product.size || '-',
                product.type_product_display || product.type_product || '-',
                product.renewal_months ?? '-',
                formatDate(issue.issued_at),
                calculateNextIssueDate(issue.issued_at, product.renewal_months),
                issue.image ? `Да (${formatDate(issue.issued_at)})` : 'Нет',
            ])),
        );

        const excelRows = rawRows.map((row, rowIndex) => [rowIndex + 1, ...row]);

        if (!excelRows.length) {
            return;
        }

        try {
            const worksheet = XLSX.utils.aoa_to_sheet([headers, ...excelRows]);
            worksheet['!cols'] = [
                { wch: 6 },
                { wch: 18 },
                { wch: 18 },
                { wch: 20 },
                { wch: 16 },
                { wch: 28 },
                { wch: 20 },
                { wch: 20 },
                { wch: 26 },
                { wch: 12 },
                { wch: 26 },
                { wch: 12 },
                { wch: 12 },
                { wch: 22 },
                { wch: 16 },
                { wch: 18 },
                { wch: 18 },
            ];

            const baseCellStyle = {
                border: {
                    top: { style: 'thin', color: { rgb: 'BFBFBF' } },
                    bottom: { style: 'thin', color: { rgb: 'BFBFBF' } },
                    left: { style: 'thin', color: { rgb: 'BFBFBF' } },
                    right: { style: 'thin', color: { rgb: 'BFBFBF' } },
                },
                alignment: {
                    horizontal: 'center',
                    vertical: 'center',
                    wrapText: true,
                },
            };

            const headerStyle = {
                ...baseCellStyle,
                fill: {
                    fgColor: { rgb: '1F4E78' },
                },
                font: {
                    bold: true,
                    color: { rgb: 'FFFFFF' },
                },
            };

            const totalRows = excelRows.length + 1;
            const totalCols = headers.length;

            for (let row = 0; row < totalRows; row += 1) {
                for (let col = 0; col < totalCols; col += 1) {
                    const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                    const cell = worksheet[cellAddress] as any;
                    if (!cell) continue;
                    cell.s = row === 0 ? headerStyle : baseCellStyle;
                }
            }

            worksheet['!rows'] = [{ hpt: 24 }];

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'PPE History');

            const datePart = new Date().toISOString().slice(0, 10);
            const fromPart = issuedFromDate ? issuedFromDate : 'all';
            const toPart = issuedToDate ? issuedToDate : 'all';
            XLSX.writeFile(workbook, `ppe_history_${fromPart}_${toPart}_${datePart}.xlsx`);
            toast.success(`Успешно экспортировано ${excelRows.length} записей в Excel`);
        } catch (error) {
            console.error('Ошибка при экспорте PPE history:', error);
            toast.error('Произошла ошибка при экспорте данных');
        }
    };

    const openDatePicker = (input: HTMLInputElement | null) => {
        if (!input) return;
        const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
        if (typeof pickerInput.showPicker === 'function') {
            pickerInput.showPicker();
            return;
        }
        input.focus();
        input.click();
    };

    const closePreviewModal = () => {
        setPreviewImage(null);
    };

    const tableHeader = (
        <thead>
            <tr className="border-b border-stroke dark:border-strokedark text-left">
                <th className="px-4 py-3 w-16">№</th>
                <th className="px-4 py-3">Наименование</th>
                <th className="px-4 py-3">Размер</th>
                <th className="px-4 py-3">Ед. изм.</th>
                <th className="px-4 py-3">Срок обновления (мес.)</th>
                <th className="px-4 py-3">Дата выдачи</th>
                <th className="px-4 py-3">Следующая выдача</th>
                <th className="px-4 py-3">Подтверждено через Face ID</th>
            </tr>
        </thead>
    );

    useEffect(() => {
        if (!slug) return;

        axioss
            .get(`${BASE_URL}/item-view/${slug}`)
            .then(async (response) => {
                const detail = response.data as ItemDetail;
                const hasHistory = Array.isArray(detail.issue_history) && detail.issue_history.length > 0;
                const employeeId = detail.employee?.id;

                if (hasHistory || !employeeId) {
                    setItemDetailData(detail);
                    return;
                }

                try {
                    const allItemsResponse = await axioss.get(
                        `${BASE_URL}/all-items/?employee_id=${employeeId}&no_pagination=true`,
                    );

                    const items = Array.isArray(allItemsResponse.data) ? allItemsResponse.data : [];
                    const fallbackHistory = items
                        .map((item: ItemDetail) => ({
                            id: Number(item.id),
                            slug: (item as any).slug ?? null,
                            image: (item as any).image ?? null,
                            issued_at: item.issued_at ?? null,
                            next_due_date: (item as any).next_due_date ?? null,
                            is_current: Number(item.id) === Number(detail.id),
                            issued_by_info: item.issued_by_info ?? null,
                            ppeproduct_info: item.ppeproduct_info ?? [],
                        }))
                        .filter((item) => Number.isFinite(item.id));

                    setItemDetailData({
                        ...detail,
                        issue_history: fallbackHistory,
                    });
                } catch (historyError) {
                    console.log(historyError);
                    setItemDetailData(detail);
                }
            })
            .catch((err) => console.log(err));
    }, [slug]);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-12">
            <div className="col-span-12 mx-3">
                <div className="rounded-md border border-stroke bg-white dark:border-strokedark dark:bg-boxdark">
                    <div className="px-4 py-3 border-b border-stroke dark:border-strokedark flex items-center justify-between gap-3">
                        <h2 className="font-semibold">Средства защиты</h2>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={exportFilteredHistoryToExcel}
                                disabled={displayedHistoryGroups.length === 0}
                                className="rounded bg-meta-3 px-3 py-2 text-sm font-medium text-white hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                title="Скачать Excel"
                                aria-label="Скачать Excel"
                            >
                                <FaFileExcel className="text-lg" />
                            </button>
                            {canAddItem ? (
                                <Link
                                    to={slug ? `/add-item/${slug}` : '/'}
                                    className="flex items-center justify-center gap-2 rounded-md bg-meta-3 py-2 px-3 text-center text-sm font-medium text-white hover:bg-opacity-90 lg:px-5"
                                >
                                    <GrAddCircle className='text-base' />
                                    Добавить
                                </Link>
                            ) : null}
                        </div>
                    </div>

                    <div className="p-4 space-y-4">
                        <div className="rounded-md border border-stroke dark:border-strokedark p-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex w-full flex-wrap gap-3 xl:w-1/2 xl:flex-nowrap">
                                <div className="w-full xl:flex-1">
                                    <select
                                        value={productFilterId}
                                        onChange={(event) => setProductFilterId(event.target.value ? Number(event.target.value) : '')}
                                        className="h-[42px] w-full rounded border border-stroke bg-white px-3 text-base text-slate-700 dark:border-strokedark dark:bg-boxdark"
                                    >
                                        <option value="">Все средства защиты</option>
                                        {historyProductOptions.map((product) => (
                                            <option key={product.id} value={product.id}>
                                                {product.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="w-full xl:flex-1">
                                    <input
                                        type="text"
                                        value={sizeFilter}
                                        onChange={(event) => setSizeFilter(event.target.value)}
                                        placeholder="Фильтр по размеру"
                                        className="h-[42px] w-full rounded border border-stroke bg-white px-3 text-base text-slate-700 dark:border-strokedark dark:bg-boxdark"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setProductFilterId('');
                                        setSizeFilter('');
                                    }}
                                    className="h-[42px] rounded border border-stroke bg-white px-6 text-base text-slate-700 hover:bg-slate-50 dark:border-strokedark dark:bg-boxdark dark:hover:bg-boxdark-2"
                                >
                                    Сбросить
                                </button>
                            </div>

                            <div className="ml-auto flex flex-wrap items-center gap-3">
                                <label className="mb-1 block text-sm font-medium">C даты</label>
                                <div className="relative">
                                    <input
                                        ref={issuedFromInputRef}
                                        type="date"
                                        value={issuedFromDate}
                                        onChange={(event) => setIssuedFromDate(event.target.value)}
                                        className="rounded border px-3 py-2 pr-10 text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => openDatePicker(issuedFromInputRef.current)}
                                        className="absolute inset-y-0 right-3 flex items-center text-slate-500"
                                        aria-label="Открыть календарь"
                                    >
                                        <FaRegCalendarAlt />
                                    </button>
                                </div>
                                <label className="mb-1 block text-sm font-medium">По дату</label>
                                <div className="relative">
                                    <input
                                        ref={issuedToInputRef}
                                        type="date"
                                        value={issuedToDate}
                                        onChange={(event) => setIssuedToDate(event.target.value)}
                                        className="rounded border px-3 py-2 pr-10 text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => openDatePicker(issuedToInputRef.current)}
                                        className="absolute inset-y-0 right-3 flex items-center text-slate-500"
                                        aria-label="Открыть календарь"
                                    >
                                        <FaRegCalendarAlt />
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIssuedFromDate('');
                                        setIssuedToDate('');
                                    }}
                                    className="rounded border border-stroke px-3 py-2 text-sm hover:bg-slate-50 dark:border-strokedark dark:hover:bg-boxdark-2"
                                >
                                    Сбросить фильтр
                                </button>
                            </div>
                        </div>

                        {historyGroups.length > 0 ? (
                            displayedHistoryGroups.length > 0 ? displayedHistoryGroups.map((issue) => (
                                <div
                                    key={`issue-${issue.id}-${issue.displayNumber}`}
                                    className={`rounded-md border border-stroke dark:border-strokedark overflow-hidden ${issue.is_current ? 'ring-1 ring-meta-3/40' : ''}`}
                                >
                                    <div className="px-4 py-2 border-b border-stroke dark:border-strokedark bg-slate-50 dark:bg-boxdark-2 flex flex-wrap items-center justify-between gap-2">
                                        <div className="font-medium text-sm">
                                            Выдача #{issue.displayNumber}
                                        </div>
                                        <div className="text-xs text-slate-600 dark:text-slate-300">
                                            Дата выдачи: {formatDate(issue.issued_at)}
                                        </div>
                                        {issue.is_current ? (
                                            <span className="text-xs px-2 py-1 rounded bg-meta-3/15 text-meta-3 font-medium">
                                                Новая выдача
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            {tableHeader}
                                            <tbody>
                                                {(issue.ppeproduct_info ?? []).map((product, productIndex) => (
                                                    <tr
                                                        key={`${issue.id}-${product.id}-${productIndex}`}
                                                        className={`border-b border-stroke dark:border-strokedark ${productIndex % 2 === 0 ? 'bg-white dark:bg-boxdark' : 'bg-slate-50/40 dark:bg-boxdark-2'}`}
                                                    >
                                                        <td className="px-4 py-3">{productIndex + 1}</td>
                                                        <td className="px-4 py-3">{product.name || '-'}</td>
                                                        <td className="px-4 py-3">{product.size || '-'}</td>
                                                        <td className="px-4 py-3">{product.type_product_display || product.type_product || '-'}</td>
                                                        <td className="px-4 py-3">{product.renewal_months ?? '-'}</td>
                                                        <td className="px-4 py-3">{formatDate(issue.issued_at)}</td>
                                                        <td className="px-4 py-3">{calculateNextIssueDate(issue.issued_at, product.renewal_months)}</td>
                                                        {productIndex === 0 ? (
                                                            <td
                                                                className="px-4 py-3 align-top"
                                                                rowSpan={Math.max((issue.ppeproduct_info ?? []).length, 1)}
                                                            >
                                                                {issue.image ? (
                                                                    <div className="flex flex-col items-start gap-1">
                                                                        <img
                                                                            src={resolveImageUrl(issue.image)}
                                                                            alt="issue_photo"
                                                                            className="h-14 w-14 rounded border object-cover cursor-pointer"
                                                                            onClick={() =>
                                                                                setPreviewImage({
                                                                                    imageUrl: resolveImageUrl(issue.image),
                                                                                    issuedAt: issue.issued_at,
                                                                                })
                                                                            }
                                                                        />
                                                                        <div className="text-[11px] text-slate-500 dark:text-slate-300">
                                                                            Проверено: {formatDate(issue.issued_at)}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-slate-400">-</span>
                                                                )}
                                                            </td>
                                                        ) : null}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )) : (
                                <div className="rounded-md border border-dashed border-stroke dark:border-strokedark px-4 py-8 text-center text-gray-500">
                                    По выбранным фильтрам записи не найдены.
                                </div>
                            )
                        ) : itemDetailData?.ppeproduct_info && itemDetailData.ppeproduct_info.length > 0 ? (
                            <div className="rounded-md border border-stroke dark:border-strokedark overflow-hidden">
                                <div className="px-4 py-2 border-b border-stroke dark:border-strokedark bg-slate-50 dark:bg-boxdark-2 text-sm font-medium">
                                    Последняя выдача
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        {tableHeader}
                                        <tbody>
                                            {itemDetailData.ppeproduct_info.map((row, index) => (
                                                <tr key={row.id} className={`border-b border-stroke dark:border-strokedark ${index % 2 === 0 ? 'bg-white dark:bg-boxdark' : 'bg-slate-50/40 dark:bg-boxdark-2'}`}>
                                                    <td className="px-4 py-3">{index + 1}</td>
                                                    <td className="px-4 py-3">{row.name || '-'}</td>
                                                    <td className="px-4 py-3">{row.size || '-'}</td>
                                                    <td className="px-4 py-3">{row.type_product_display || row.type_product || '-'}</td>
                                                    <td className="px-4 py-3">{row.renewal_months ?? '-'}</td>
                                                    <td className="px-4 py-3">{formatDate(itemDetailData.issued_at)}</td>
                                                    <td className="px-4 py-3">{calculateNextIssueDate(itemDetailData.issued_at, row.renewal_months)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : itemDetailData?.ppeproduct && itemDetailData.ppeproduct.length > 0 ? (
                            <div className="rounded-md border border-stroke dark:border-strokedark overflow-hidden">
                                <div className="px-4 py-2 border-b border-stroke dark:border-strokedark bg-slate-50 dark:bg-boxdark-2 text-sm font-medium">
                                    Последняя выдача
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        {tableHeader}
                                        <tbody>
                                            {itemDetailData.ppeproduct.map((row, index) => (
                                                <tr key={index} className={`border-b border-stroke dark:border-strokedark ${index % 2 === 0 ? 'bg-white dark:bg-boxdark' : 'bg-slate-50/40 dark:bg-boxdark-2'}`}>
                                                    <td className="px-4 py-3">{index + 1}</td>
                                                    <td className="px-4 py-3">
                                                        {typeof row === 'number' ? `ID: ${row}` : row.name || `ID: ${row.id}`}
                                                    </td>
                                                    <td className="px-4 py-3">-</td>
                                                    <td className="px-4 py-3">-</td>
                                                    <td className="px-4 py-3">-</td>
                                                    <td className="px-4 py-3">{formatDate(itemDetailData.issued_at)}</td>
                                                    <td className="px-4 py-3">-</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-md border border-dashed border-stroke dark:border-strokedark px-4 py-8 text-center text-gray-500">
                                СИЗ (средства индивидуальной защиты) ещё не выданы.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {previewImage ? (
                <div
                    className="fixed inset-0 z-99999 flex items-center justify-center bg-black/60 p-4"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) {
                            closePreviewModal();
                        }
                    }}
                >
                    <div className="w-full max-w-xl rounded-md bg-white p-4 shadow-xl dark:bg-boxdark">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold">Подтвержденное фото</h3>
                            <button
                                type="button"
                                onClick={closePreviewModal}
                                className="flex h-6 w-6 items-center justify-center rounded border text-sm leading-none hover:bg-slate-50 dark:hover:bg-boxdark-2"
                                aria-label="Close preview"
                            >
                                ×
                            </button>
                        </div>

                        <div className="rounded border p-2">
                            <img
                                src={previewImage.imageUrl}
                                alt="preview_issue_photo"
                                className="max-h-[70vh] w-full rounded object-contain"
                            />
                        </div>

                        <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                            Проверено: {formatDate(previewImage.issuedAt)}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
