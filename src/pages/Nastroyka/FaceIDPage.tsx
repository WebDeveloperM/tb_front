import Breadcrumb from '../../components/Breadcrumbs/Breadcrumb';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import axioss from '../../api/axios';
import { getStoredFeatureAccess, normalizeRole } from '../../utils/pageAccess';

type Employee = {
  id: number;
  slug: string;
  first_name: string;
  last_name: string;
  surname: string;
  tabel_number: string;
  position: string;
  requires_face_id_checkout: boolean;
};

const getBackendError = (error: any, fallback: string) => {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  if (typeof data?.detail === 'string' && data.detail.trim()) return data.detail;
  const firstField = Object.values(data)[0];
  if (Array.isArray(firstField) && firstField.length) {
    return String(firstField[0]);
  }
  return fallback;
};

const FaceIDPage = () => {
  const navigate = useNavigate();
  const role = useMemo(() => normalizeRole(localStorage.getItem('role')), []);
  const canManageFaceIdControl = useMemo(() => getStoredFeatureAccess(role).face_id_control, [role]);

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tableNumberSearch, setTableNumberSearch] = useState('');
  const [employeeNameSearch, setEmployeeNameSearch] = useState('');

  // Modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingEmployee, setPendingEmployee] = useState<Employee | null>(null);
  const [pendingNewStatus, setPendingNewStatus] = useState<boolean>(false);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const response = await axioss.get('/employees/face-id-exemption/');
      setEmployees(response.data?.employees || []);
    } catch (error) {
      toast.error(getBackendError(error, 'Не удалось загрузить список сотрудников'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManageFaceIdControl) {
      setLoading(false);
      return;
    }
    loadEmployees();
  }, [canManageFaceIdControl]);

  const filteredEmployees = useMemo(() => {
    const tableFilter = tableNumberSearch.trim().toLowerCase();
    const nameFilter = employeeNameSearch.trim().toLowerCase();
    return employees.filter((emp) => {
      const fullName = `${emp.last_name} ${emp.first_name} ${emp.surname}`.trim().toLowerCase();
      const tabelNumber = String(emp.tabel_number || '').toLowerCase();
      const matchesTable = !tableFilter || tabelNumber.includes(tableFilter);
      const matchesName = !nameFilter || fullName.includes(nameFilter);
      return matchesTable && matchesName;
    });
  }, [employees, tableNumberSearch, employeeNameSearch]);

  const handleToggleFaceIdExemption = async (employeeId: number, newStatus: boolean) => {
    try {
      const response = await axioss.patch(`/employees/${employeeId}/face-id-exemption/`, {
        requires_face_id_checkout: newStatus,
      });
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === employeeId ? { ...emp, requires_face_id_checkout: newStatus } : emp
        )
      );
      const message = newStatus
        ? `Face ID требуется для ${response.data.employee.full_name}`
        : `Face ID НЕ требуется для ${response.data.employee.full_name}`;
      toast.success(message);
    } catch (error) {
      toast.error(getBackendError(error, 'Ошибка при обновлении статуса Face ID'));
    }
  };

  const openConfirmModal = (employee: Employee, newStatus: boolean) => {
    setPendingEmployee(employee);
    setPendingNewStatus(newStatus);
    setShowConfirmModal(true);
  };

  const closeConfirmModal = () => {
    setShowConfirmModal(false);
    setPendingEmployee(null);
    setPendingNewStatus(false);
  };

  const confirmToggle = () => {
    if (pendingEmployee) {
      handleToggleFaceIdExemption(pendingEmployee.id, pendingNewStatus);
    }
    closeConfirmModal();
  };

  if (!canManageFaceIdControl) {
    return (
      <>
        <Breadcrumb pageName="Face ID настройки" />
        <div className="rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="text-base text-red-600">Нет доступа к странице</div>
          <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            У вашей роли нет доступа к управлению Face ID.
          </div>
          <button
            onClick={() => navigate('/nastroyka')}
            className="mt-4 rounded border border-stroke px-4 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-700"
          >
            ← Назад
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Face ID настройки" />

      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/nastroyka')}
            className="rounded border border-stroke px-4 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-700"
          >
            ← Назад
          </button>
        </div>

        {loading && (
          <div className="rounded-sm border border-stroke bg-white p-4 text-sm dark:border-strokedark dark:bg-boxdark">
            Загрузка...
          </div>
        )}

        <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
            Выберите сотрудников, которым не требуется Face ID верификация при получении СИЗ.
          </p>

          <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              type="text"
              value={tableNumberSearch}
              onChange={(event) => setTableNumberSearch(event.target.value)}
              placeholder="Поиск по табельному номеру"
              className="w-full rounded border border-stroke bg-white px-3 py-2 text-sm dark:border-strokedark dark:bg-boxdark"
            />
            <input
              type="text"
              value={employeeNameSearch}
              onChange={(event) => setEmployeeNameSearch(event.target.value)}
              placeholder="Поиск по пользователю"
              className="w-full rounded border border-stroke bg-white px-3 py-2 text-sm dark:border-strokedark dark:bg-boxdark"
            />
          </div>

          <div className="max-h-96 overflow-auto rounded border border-stroke bg-white dark:border-strokedark dark:bg-boxdark">
            {loading ? (
              <div className="p-4 text-center text-sm text-slate-500">Загрузка сотрудников...</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">Нет сотрудников</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">№</th>
                    <th className="px-3 py-2 text-left font-semibold">Таб. номер</th>
                    <th className="px-3 py-2 text-left font-semibold">Пользователь</th>
                    <th className="px-3 py-2 text-left font-semibold">Требование</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp, index) => (
                    <tr key={emp.id} className="border-t border-stroke dark:border-strokedark">
                      <td className="px-3 py-2">{index + 1}</td>
                      <td className="px-3 py-2">{emp.tabel_number}</td>
                      <td className="px-3 py-2">{emp.last_name} {emp.first_name} {emp.surname}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => openConfirmModal(emp, !emp.requires_face_id_checkout)}
                          className={`flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                            emp.requires_face_id_checkout
                              ? 'border border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'border border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                          }`}
                        >
                          <span>{emp.requires_face_id_checkout ? '✓ Face ID требуется' : '✗ Face ID не требуется'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && pendingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl dark:bg-boxdark">
            <div className="p-6">
              {/* Icon */}
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                  <svg
                    className="h-8 w-8 text-yellow-600 dark:text-yellow-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
              </div>

              {/* Text */}
              <p className="mb-6 text-center text-base text-gray-700 dark:text-gray-300">
                Вы уверены, что хотите выполнить это задание?
              </p>

              {/* Buttons */}
              <div className="flex justify-center gap-3">
                <button
                  onClick={closeConfirmModal}
                  className="rounded border border-stroke px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-strokedark dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Отменить
                </button>
                <button
                  onClick={confirmToggle}
                  className="rounded bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-opacity-90"
                >
                  Подтверждение
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FaceIDPage;
