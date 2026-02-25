import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import Breadcrumb from '../../components/Breadcrumbs/Breadcrumb';
import axioss from '../../api/axios';
import { BASE_URL } from '../../utils/urls';
import { isAuthenticated } from '../../utils/auth';
import { FaLongArrowAltLeft } from 'react-icons/fa';


type PpeOption = {
  id: number;
  name: string;
  type_product: string | null;
  type_product_display?: string | null;
  renewal_months: number;
  size?: string;
};

type AddItemResponse = {
  item?: {
    employee?: {
      first_name?: string;
      last_name?: string;
      surname?: string;
      tabel_number?: string;
      position?: string;
      department?: { name?: string };
      section?: { name?: string };
    };
    ppeproduct_info?: Array<{ id: number; size?: string }>;
    issued_at?: string | null;
  };
  ppe_products?: PpeOption[];
};

const AddItemPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<AddItemResponse | null>(null);
  const toInputDateTime = (value?: string | null) => {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [issuedAt, setIssuedAt] = useState<string>(() => toInputDateTime());
  const [selectedPpeIds, setSelectedPpeIds] = useState<number[]>([]);
  const [ppeSizes, setPpeSizes] = useState<Record<number, string>>({});

  const employee = data?.item?.employee;
  const ppeOptions = data?.ppe_products ?? [];

  useEffect(() => {
    if (!slug) return;

    setLoading(true);
    axioss
      .get(`${BASE_URL}/add-item/${slug}`)
      .then((response) => {
        const payload = response.data as AddItemResponse;
        setData(payload);

        const preselected = (payload.item?.ppeproduct_info ?? [])
          .map((x) => Number(x.id))
          .filter((x) => Number.isFinite(x));

        if (preselected.length > 0) {
          setSelectedPpeIds(preselected);
        }

        const prefilledSizes = (payload.item?.ppeproduct_info ?? []).reduce((acc, product) => {
          const productId = Number(product.id);
          if (Number.isFinite(productId) && product.size) {
            acc[productId] = String(product.size);
          }
          return acc;
        }, {} as Record<number, string>);
        setPpeSizes(prefilledSizes);

        if (payload.item?.issued_at) {
          setIssuedAt(toInputDateTime(payload.item.issued_at));
        }
      })
      .catch(() => setError("Ma'lumotlarni yuklashda xatolik"))
      .finally(() => setLoading(false));
  }, [slug]);

  const canSubmit = useMemo(() => selectedPpeIds.length > 0 && Boolean(issuedAt), [selectedPpeIds, issuedAt]);

  const togglePpe = (id: number) => {
    setSelectedPpeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const setPpeSizeValue = (id: number, value: string) => {
    setPpeSizes((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSubmit = () => {
    if (!slug || !canSubmit || saving) return;

    setSaving(true);
    setError('');

    axioss
      .post(`${BASE_URL}/add-item/${slug}`, {
        issued_at: issuedAt,
        ppeproduct: selectedPpeIds,
        ppe_sizes: Object.fromEntries(
          selectedPpeIds
            .map((id) => [String(id), (ppeSizes[id] || '').trim()])
            .filter(([, size]) => Boolean(size)),
        ),
      })
      .then((response) => {
        const newSlug = response.data?.slug;
        if (newSlug) {
          navigate(`/item-view/${newSlug}`);
          return;
        }
        navigate(-1);
      })
      .catch((err) => {
        const backendError = err?.response?.data?.error;
        setError(backendError || "Saqlashda xatolik yuz berdi");
      })
      .finally(() => setSaving(false));
  };

  if (!isAuthenticated()) {
    return <Navigate to="/auth/signin" />;
  }

  return (
    <>
      <Breadcrumb pageName="Информация о сотрудниках" />

      <div className="grid grid-cols-1 sm:grid-cols-4">
        <div className="col-span-4">
          <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="border-b border-stroke py-4 px-6.5 dark:border-strokedark">
              <h3 className="font-medium text-black dark:text-white">Добавить средства защиты</h3>
            </div>

            <div className="p-6.5">
              {loading ? (
                <div>Загрузка...</div>
              ) : (
                <>
                  <div className="grid sm:grid-cols-12 gap-4 mb-6">
                    <div className="col-span-3">
                      <label className="mb-2 block">Фамилия</label>
                      <input className="w-full rounded border px-3 py-2" value={employee?.last_name || '-'} disabled />
                    </div>
                    <div className="col-span-3">
                      <label className="mb-2 block">Имя</label>
                      <input className="w-full rounded border px-3 py-2" value={employee?.first_name || '-'} disabled />
                    </div>
                    <div className="col-span-3">
                      <label className="mb-2 block">Отчество</label>
                      <input className="w-full rounded border px-3 py-2" value={employee?.surname || '-'} disabled />
                    </div>
                    <div className="col-span-3">
                      <label className="mb-2 block">Табельный номер</label>
                      <input className="w-full rounded border px-3 py-2" value={employee?.tabel_number || '-'} disabled />
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="mb-2 block">Дата выдачи</label>
                    <input
                      type="datetime-local"
                      className="w-full rounded border px-3 py-2"
                      value={issuedAt}
                      onChange={(e) => setIssuedAt(e.target.value)}
                    />
                  </div>

                  <div className="mb-6">
                    <label className="mb-3 block">Средства защиты</label>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {ppeOptions.map((item) => (
                        <div key={item.id} className="flex items-start gap-3 border rounded p-3">
                          <input
                            type="checkbox"
                            checked={selectedPpeIds.includes(item.id)}
                            onChange={() => togglePpe(item.id)}
                            className="mt-1"
                          />
                          <div className="w-full">
                            <div className="font-medium">{item.name}</div>
                            <div className="text-sm text-gray-500">
                              {(item.type_product_display || item.type_product || '-') + ` • ${item.renewal_months} мес.`}
                            </div>

                            {selectedPpeIds.includes(item.id) && (
                              <div className="mt-2">
                                <label className="mb-1 block text-sm text-gray-700">Размер</label>
                                <input
                                  type="text"
                                  value={ppeSizes[item.id] || ''}
                                  onChange={(e) => setPpeSizeValue(item.id, e.target.value)}
                                  placeholder="Введите размер"
                                  className="w-full rounded border px-2 py-1 text-sm"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {error && <div className="mb-4 text-red-600">{error}</div>}

                  <div className="flex justify-between border-t border-stroke pt-4 dark:border-strokedark">
                    <Link
                      to={slug ? `/item-view/${slug}` : '/'}
                      className="flex items-center justify-center gap-2 rounded-md bg-slate-500 py-2 px-3 font-medium text-white hover:bg-opacity-90"
                    >
                      <FaLongArrowAltLeft className="text-xl" />
                      Назад
                    </Link>

                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!canSubmit || saving}
                      className="rounded-md bg-meta-3 py-2 px-5 font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
                    >
                      {saving ? 'Сохранение...' : 'Добавить'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AddItemPage;
