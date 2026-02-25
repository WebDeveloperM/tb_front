import { useEffect, useMemo, useState } from 'react';
import Breadcrumb from '../../components/Breadcrumbs/Breadcrumb';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Tabs } from 'flowbite-react';
import { FaLongArrowAltLeft } from 'react-icons/fa';
import { IoIosSave } from 'react-icons/io';
import { toast } from 'react-toastify';
import { Calendar } from 'primereact/calendar';
import axioss from '../../api/axios';
import { BASE_URL } from '../../utils/urls';
import { isAuthenticated } from '../../utils/auth';
import { ModalDataInput } from '../../components/Input/ModalDataInput';
import ViewPO from '../ViewCompyuter/ViewPO';

type ItemDetail = {
  slug?: string;
  departments?: Array<{
    id: number;
    name: string;
    boss_fullName?: string;
  }>;
  sections?: Array<{
    id: number;
    name: string;
    department_id: number;
  }>;
  employee?: {
    first_name?: string;
    last_name?: string;
    surname?: string;
    tabel_number?: string;
    position?: string;
    gender?: 'M' | 'F' | string;
    height?: string;
    clothe_size?: string;
    shoe_size?: string;
    headdress_size?: string;
    date_of_employment?: string | null;
    date_of_change_position?: string | null;
    department?: {
      id?: number;
      name?: string;
      boss_fullName?: string;
    };
    section?: {
      id?: number;
      name?: string;
    };
  };
};

const toDateInput = (value?: string | null) => {
  if (!value) return '';
  return String(value).slice(0, 10);
};

const toCalendarDate = (value?: string | null) => {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const toApiDate = (value: Date | null) => {
  if (!value) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const EditEmployeePage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [itemDetail, setItemDetail] = useState<ItemDetail | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    surname: '',
    tabel_number: '',
    position: '',
    gender: '',
    height: '',
    clothe_size: '',
    shoe_size: '',
    headdress_size: '',
    date_of_employment: '',
    date_of_change_position: '',
    department: '',
    section: '',
  });

  useEffect(() => {
    if (!slug) return;

    axioss
      .get(`${BASE_URL}/item-edit-personal/${slug}`)
      .then((response) => {
        const payload = response.data as ItemDetail;
        setItemDetail(payload);
        setForm({
          first_name: payload.employee?.first_name || '',
          last_name: payload.employee?.last_name || '',
          surname: payload.employee?.surname || '',
          tabel_number: payload.employee?.tabel_number || '',
          position: payload.employee?.position || '',
          gender: payload.employee?.gender || '',
          height: payload.employee?.height || '',
          clothe_size: payload.employee?.clothe_size || '',
          shoe_size: payload.employee?.shoe_size || '',
          headdress_size: payload.employee?.headdress_size || '',
          date_of_employment: toDateInput(payload.employee?.date_of_employment),
          date_of_change_position: toDateInput(payload.employee?.date_of_change_position),
          department: payload.employee?.department?.id ? String(payload.employee?.department?.id) : '',
          section: payload.employee?.section?.id ? String(payload.employee?.section?.id) : '',
        });
      })
      .catch(() => toast.error('Данные сотрудника не найдены'));
  }, [slug]);

  const filteredSections = useMemo(() => {
    if (!form.department) return [];
    return (itemDetail?.sections || []).filter(
      (section) => Number(section.department_id) === Number(form.department),
    );
  }, [itemDetail?.sections, form.department]);

  const selectedDepartmentBoss = useMemo(() => {
    const selectedDepartment = (itemDetail?.departments || []).find(
      (department) => Number(department.id) === Number(form.department),
    );
    return selectedDepartment?.boss_fullName || '-';
  }, [itemDetail?.departments, form.department]);

  const customTheme = useMemo(
    () => ({
      tablist: {
        tabitem: {
          base: 'p-4',
          active: {
            on: 'border-b-2 border-red-500',
            off: 'border-transparent',
          },
        },
      },
    }),
    [],
  );

  const handleSave = async () => {
    if (!slug) return;

    const requiredFields: Array<{ key: keyof typeof form; label: string }> = [
      { key: 'last_name', label: 'Фамилия' },
      { key: 'first_name', label: 'Имя' },
      { key: 'surname', label: 'Отчество' },
      { key: 'tabel_number', label: 'Табельный номер' },
      { key: 'position', label: 'Должность' },
      { key: 'department', label: 'Цех' },
      { key: 'section', label: 'Отдел' },
      { key: 'gender', label: 'Пол' },
      { key: 'height', label: 'Рост' },
      { key: 'clothe_size', label: 'Размер одежды' },
      { key: 'shoe_size', label: 'Размер обуви' },
      { key: 'headdress_size', label: 'Размер головного убора' },
      { key: 'date_of_employment', label: 'Дата приема на работу' },
    ];

    for (const field of requiredFields) {
      const value = form[field.key];
      if (!String(value ?? '').trim()) {
        toast.error(`${field.label} поле не может быть пустым`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload: Record<string, string | null> = {
        first_name: form.first_name,
        last_name: form.last_name,
        surname: form.surname,
        tabel_number: form.tabel_number,
        position: form.position,
        gender: form.gender,
        height: form.height,
        clothe_size: form.clothe_size,
        shoe_size: form.shoe_size,
        headdress_size: form.headdress_size,
        date_of_employment: form.date_of_employment,
        date_of_change_position: form.date_of_change_position || null,
        department: form.department,
        section: form.section,
      };

      const response = await axioss.patch(`${BASE_URL}/item-edit-personal/${slug}`, payload);

      const responseData = response.data as ItemDetail;
      setItemDetail(responseData);
      setForm({
        first_name: responseData.employee?.first_name || '',
        last_name: responseData.employee?.last_name || '',
        surname: responseData.employee?.surname || '',
        tabel_number: responseData.employee?.tabel_number || '',
        position: responseData.employee?.position || '',
        gender: responseData.employee?.gender || '',
        height: responseData.employee?.height || '',
        clothe_size: responseData.employee?.clothe_size || '',
        shoe_size: responseData.employee?.shoe_size || '',
        headdress_size: responseData.employee?.headdress_size || '',
        date_of_employment: toDateInput(responseData.employee?.date_of_employment),
        date_of_change_position: toDateInput(responseData.employee?.date_of_change_position),
        department: responseData.employee?.department?.id ? String(responseData.employee?.department?.id) : '',
        section: responseData.employee?.section?.id ? String(responseData.employee?.section?.id) : '',
      });
      toast.success('Персональные данные успешно обновлены');
      navigate('/');
    } catch (error: any) {
      const apiData = error?.response?.data;
      const firstError = apiData && typeof apiData === 'object' ? Object.values(apiData)[0] : null;
      const message =
        (Array.isArray(firstError) ? firstError[0] : firstError) ||
        apiData?.detail ||
        'Ошибка при сохранении данных';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthenticated()) {
    return <Navigate to="/auth/signin" />;
  }

  return (
    <>
      <Breadcrumb pageName="Редактирование сотрудника" />

      <div className="grid grid-cols-1 sm:grid-cols-4">
        <div className="col-span-4">
          <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="max-w-full m-4">
              <Tabs aria-label="Tabs example" theme={customTheme}>
                <Tabs.Item active title="Персональные данные">
                  <div>
                    <h1 className="p-5 pt-5 pb-3 font-semibold">Сотрудник</h1>
                    <div className="p-5 py-3 pb-5 border-b mb-2">
                      <div className="grid sm:grid-cols-12 gap-4">
                        <div className="col-span-2">
                          <label className="mb-3 block text-black dark:text-white">Фамилия</label>
                          <input
                            value={form.last_name}
                            onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))}
                            className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="mb-3 block text-black dark:text-white">Имя</label>
                          <input
                            value={form.first_name}
                            onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))}
                            className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="mb-3 block text-black dark:text-white">Отчество</label>
                          <input
                            value={form.surname}
                            onChange={(e) => setForm((prev) => ({ ...prev, surname: e.target.value }))}
                            className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="mb-3 block text-black dark:text-white">Табельный номер</label>
                          <input
                            value={form.tabel_number}
                            onChange={(e) => setForm((prev) => ({ ...prev, tabel_number: e.target.value }))}
                            className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                          />
                        </div>
                        <div className="col-span-4">
                          <label className="mb-3 block text-black dark:text-white">Должность</label>
                          <input
                            value={form.position}
                            onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))}
                            className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-12 gap-3 mt-4">
                        <div className="col-span-3">
                          <label className="mb-3 block text-black dark:text-white">Цех</label>
                          <select
                            value={form.department}
                            onChange={(e) => {
                              const nextDepartment = e.target.value;
                              setForm((prev) => ({ ...prev, department: nextDepartment, section: '' }));
                            }}
                            className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                          >
                            <option value="">Выберите цех</option>
                            {(itemDetail?.departments || []).map((department) => (
                              <option key={department.id} value={department.id}>
                                {department.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-3">
                          <label className="mb-3 block text-black dark:text-white">Отдел</label>
                          <select
                            value={form.section}
                            onChange={(e) => setForm((prev) => ({ ...prev, section: e.target.value }))}
                            disabled={!form.department}
                            className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:text-white"
                          >
                            <option value="">Выберите отдел</option>
                            {filteredSections.map((section) => (
                              <option key={section.id} value={section.id}>
                                {section.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <ModalDataInput
                          label="Руководитель цеха"
                          inputData={selectedDepartmentBoss}
                          wrapperClassName="col-span-3"
                        />
                      </div>
                    </div>

                    <h1 className="p-5 pt-2 pb-3 font-semibold">Персональные данные</h1>
                    <div className="grid sm:grid-cols-12 gap-4 p-5 py-3 pb-7 border-b mb-2">
                      <div className="col-span-3">
                        <label className="mb-3 block text-black dark:text-white">Пол</label>
                        <select
                          value={form.gender}
                          onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
                          className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                        >
                          <option value="">Выберите пол</option>
                          <option value="M">Мужской</option>
                          <option value="F">Женский</option>
                        </select>
                      </div>
                      <div className="col-span-3">
                        <label className="mb-3 block text-black dark:text-white">Рост</label>
                        <input
                          value={form.height}
                          onChange={(e) => setForm((prev) => ({ ...prev, height: e.target.value }))}
                          className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="mb-3 block text-black dark:text-white">Размер одежды</label>
                        <input
                          value={form.clothe_size}
                          onChange={(e) => setForm((prev) => ({ ...prev, clothe_size: e.target.value }))}
                          className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="mb-3 block text-black dark:text-white">Размер обуви</label>
                        <input
                          value={form.shoe_size}
                          onChange={(e) => setForm((prev) => ({ ...prev, shoe_size: e.target.value }))}
                          className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="mb-3 block text-black dark:text-white">Размер головного убора</label>
                        <input
                          value={form.headdress_size}
                          onChange={(e) => setForm((prev) => ({ ...prev, headdress_size: e.target.value }))}
                          className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="mb-3 block text-black dark:text-white">Дата приема на работу</label>
                        <Calendar
                          value={toCalendarDate(form.date_of_employment)}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              date_of_employment: toApiDate((e.value as Date) || null),
                            }))
                          }
                          dateFormat="dd.mm.yy"
                          showIcon
                          className="w-full edit-date-calendar"
                          inputClassName="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="mb-3 block text-black dark:text-white">Дата последнего изменения должности</label>
                        <Calendar
                          value={toCalendarDate(form.date_of_change_position)}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              date_of_change_position: toApiDate((e.value as Date) || null),
                            }))
                          }
                          dateFormat="dd.mm.yy"
                          showIcon
                          className="w-full edit-date-calendar"
                          inputClassName="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </Tabs.Item>
                <Tabs.Item title="Средства защиты">
                  <ViewPO />
                </Tabs.Item>
              </Tabs>
            </div>

            <div className="flex justify-between border-b border-stroke py-4 px-6.5 dark:border-strokedark">
              <Link
                to={`/item-view/${slug}`}
                className="flex items-center justify-center gap-2 rounded-md bg-slate-500 py-2 px-3 text-center font-medium text-white hover:bg-opacity-90 lg:px-5 xl:px-5"
              >
                <FaLongArrowAltLeft className="text-xl" />
                Назад
              </Link>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 rounded-md bg-meta-3 py-2 px-3 text-center font-medium text-white hover:bg-opacity-90 disabled:opacity-70 lg:px-5 xl:px-7"
              >
                <IoIosSave className="text-xl" />
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditEmployeePage;
