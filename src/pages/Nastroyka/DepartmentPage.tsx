import Breadcrumb from '../../components/Breadcrumbs/Breadcrumb';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import axioss from '../../api/axios';

type Department = {
  id: number;
  name: string;
  boss_fullName: string;
};

const normalizeRole = (rawRole: string | null): 'admin' | 'warehouse_manager' | 'warehouse_staff' | 'user' => {
  const value = String(rawRole || '').trim().toLowerCase();
  if (value === 'admin' || value === 'админ') return 'admin';
  if (value === 'warehouse_manager' || value === 'складской менеджер') return 'warehouse_manager';
  if (value === 'warehouse_staff' || value === 'складской рабочий') return 'warehouse_staff';
  return 'user';
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

const DepartmentPage = () => {
  const navigate = useNavigate();
  const role = useMemo(() => normalizeRole(localStorage.getItem('role')), []);
  const canEditBaseSettings = role === 'admin' || role === 'warehouse_staff';
  const isAdmin = role === 'admin';

  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentName, setDepartmentName] = useState('');
  const [departmentBoss, setDepartmentBoss] = useState('');
  const [editingDepartmentId, setEditingDepartmentId] = useState<number | null>(null);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const response = await axioss.get('/settings/departments/');
      setDepartments(response.data || []);
    } catch (error) {
      toast.error(getBackendError(error, 'Не удалось загрузить данные'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canEditBaseSettings) {
      setLoading(false);
      return;
    }
    loadDepartments();
  }, [canEditBaseSettings]);

  const handleCreateDepartment = async (event: FormEvent) => {
    event.preventDefault();
    if (!departmentName.trim() || !departmentBoss.trim()) {
      toast.warning('Название цеха и ФИО руководителя обязательны');
      return;
    }

    try {
      if (editingDepartmentId !== null) {
        const response = await axioss.put(`/settings/departments/${editingDepartmentId}/`, {
          name: departmentName.trim(),
          boss_fullName: departmentBoss.trim(),
        });
        setDepartments((prev) => prev.map((entry) => (entry.id === editingDepartmentId ? response.data : entry)));
        toast.success('Цех обновлен');
        setEditingDepartmentId(null);
      } else {
        const response = await axioss.post('/settings/departments/', {
          name: departmentName.trim(),
          boss_fullName: departmentBoss.trim(),
        });
        setDepartments((prev) => [...prev, response.data]);
        toast.success('Цех добавлен');
      }
      setDepartmentName('');
      setDepartmentBoss('');
    } catch (error) {
      toast.error(getBackendError(error, editingDepartmentId !== null ? 'Ошибка при обновлении цеха' : 'Ошибка при добавлении цеха'));
    }
  };

  const handleEditDepartment = (item: Department) => {
    setEditingDepartmentId(item.id);
    setDepartmentName(item.name || '');
    setDepartmentBoss(item.boss_fullName || '');
  };

  const handleDeleteDepartment = async (item: Department) => {
    const isConfirmed = window.confirm(`Удалить цех "${item.name}"?`);
    if (!isConfirmed) return;

    try {
      await axioss.delete(`/settings/departments/${item.id}/`);
      setDepartments((prev) => prev.filter((entry) => entry.id !== item.id));
      if (editingDepartmentId === item.id) {
        setEditingDepartmentId(null);
        setDepartmentName('');
        setDepartmentBoss('');
      }
      toast.success('Цех удален');
    } catch (error) {
      toast.error(getBackendError(error, 'Ошибка при удалении цеха'));
    }
  };

  const handleCancelEdit = () => {
    setEditingDepartmentId(null);
    setDepartmentName('');
    setDepartmentBoss('');
  };

  if (!canEditBaseSettings) {
    return (
      <>
        <Breadcrumb pageName="Цех" />
        <div className="rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="text-base text-red-600">Нет доступа к странице</div>
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
      <Breadcrumb pageName="Цех" />

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
          <form onSubmit={handleCreateDepartment} className="mb-6 space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                placeholder="Название цеха"
                className="w-full rounded border border-stroke bg-transparent px-3 py-2 dark:border-strokedark dark:bg-transparent"
              />
              <input
                value={departmentBoss}
                onChange={(e) => setDepartmentBoss(e.target.value)}
                placeholder="ФИО руководителя"
                className="w-full rounded border border-stroke bg-transparent px-3 py-2 dark:border-strokedark dark:bg-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded bg-primary px-4 py-2 text-white">
                {editingDepartmentId !== null ? 'Сохранить' : 'Добавить'}
              </button>
              {editingDepartmentId !== null && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded border border-stroke px-4 py-2 dark:border-strokedark"
                >
                  Отмена
                </button>
              )}
            </div>
          </form>

          <div className="max-h-96 overflow-auto">
            {departments.length === 0 ? (
              <p className="text-center text-gray-500">Нет данных</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Название</th>
                    <th className="px-3 py-2 text-left font-semibold">Руководитель</th>
                    {isAdmin && <th className="px-3 py-2 text-left font-semibold">Действия</th>}
                  </tr>
                </thead>
                <tbody>
                  {departments.map((item) => (
                    <tr key={item.id} className="border-t border-stroke dark:border-strokedark">
                      <td className="px-3 py-2">{item.name}</td>
                      <td className="px-3 py-2">{item.boss_fullName}</td>
                      {isAdmin && (
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditDepartment(item)}
                              className="rounded border border-stroke px-2 py-1 text-xs dark:border-strokedark"
                            >
                              Изменить
                            </button>
                            <button
                              onClick={() => handleDeleteDepartment(item)}
                              className="rounded border border-red-400 px-2 py-1 text-xs text-red-600"
                            >
                              Удалить
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default DepartmentPage;
