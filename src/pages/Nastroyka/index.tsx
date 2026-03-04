import Breadcrumb from '../../components/Breadcrumbs/Breadcrumb';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import axioss from '../../api/axios';

type Department = {
  id: number;
  name: string;
  boss_fullName: string;
};

type Section = {
  id: number;
  department: number;
  department_name: string;
  name: string;
};

type PPEProduct = {
  id: number;
  name: string;
  renewal_months: number;
  type_product: 'Комплект' | 'Пора' | 'ШТ' | '';
  is_active: boolean;
};

type ResponsiblePerson = {
  id: number;
  full_name: string;
  position: string;
};

type SettingsUser = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'warehouse_manager' | 'user';
  base_avatar?: string | null;
  is_superuser?: boolean;
  is_active?: boolean;
};

const normalizeRole = (rawRole: string | null) => {
  const value = String(rawRole || '').trim().toLowerCase();
  if (value === 'admin' || value === 'админ') return 'admin';
  if (value === 'warehouse_manager' || value === 'складской менеджер') return 'warehouse_manager';
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

const NastroykaPage = () => {
  const role = useMemo(() => normalizeRole(localStorage.getItem('role')), []);
  const canManageSettings = role === 'admin' || role === 'warehouse_manager';

  const [loading, setLoading] = useState(true);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [products, setProducts] = useState<PPEProduct[]>([]);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [users, setUsers] = useState<SettingsUser[]>([]);

  const [departmentName, setDepartmentName] = useState('');
  const [departmentBoss, setDepartmentBoss] = useState('');

  const [sectionDepartmentId, setSectionDepartmentId] = useState<string>('');
  const [sectionName, setSectionName] = useState('');

  const [productName, setProductName] = useState('');
  const [productRenewalMonths, setProductRenewalMonths] = useState<string>('');
  const [productType, setProductType] = useState<'Комплект' | 'Пора' | 'ШТ'>('ШТ');

  const [personFullName, setPersonFullName] = useState('');
  const [personPosition, setPersonPosition] = useState('');

  const [editingDepartmentId, setEditingDepartmentId] = useState<number | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<number | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  const [userUsername, setUserUsername] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userPasswordConfirm, setUserPasswordConfirm] = useState('');
  const [userFirstName, setUserFirstName] = useState('');
  const [userLastName, setUserLastName] = useState('');
  const [userRole, setUserRole] = useState<'admin' | 'warehouse_manager' | 'user'>('user');
  const [userAvatarFile, setUserAvatarFile] = useState<File | null>(null);
  const [userAvatarPreview, setUserAvatarPreview] = useState('');
  const [userCameraOpen, setUserCameraOpen] = useState(false);
  const [userCameraLive, setUserCameraLive] = useState(false);
  const [userCameraError, setUserCameraError] = useState('');
  const [userVideoDevices, setUserVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [userSelectedDeviceId, setUserSelectedDeviceId] = useState('');

  const [openAccordions, setOpenAccordions] = useState({
    departments: false,
    sections: false,
    products: false,
    persons: false,
    users: false,
  });

  const userVideoRef = useRef<HTMLVideoElement | null>(null);
  const userCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const userStreamRef = useRef<MediaStream | null>(null);

  const toggleAccordion = (key: keyof typeof openAccordions) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [departmentsRes, sectionsRes, productsRes, personsRes] = await Promise.all([
        axioss.get('/settings/departments/'),
        axioss.get('/settings/sections/'),
        axioss.get('/settings/ppe-products/'),
        axioss.get('/settings/responsible-persons/'),
      ]);

      setDepartments(departmentsRes.data || []);
      setSections(sectionsRes.data || []);
      setProducts(productsRes.data || []);
      setPersons(personsRes.data || []);

      if (role === 'admin') {
        const usersRes = await axioss.get('/users/settings-users/');
        setUsers(usersRes.data || []);
      } else {
        setUsers([]);
      }
    } catch (error) {
      toast.error(getBackendError(error, 'Не удалось загрузить данные настроек'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManageSettings) {
      setLoading(false);
      return;
    }
    loadSettings();
  }, [canManageSettings]);

  const stopUserCamera = () => {
    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach((track) => track.stop());
      userStreamRef.current = null;
    }

    if (userVideoRef.current) {
      userVideoRef.current.srcObject = null;
    }

    setUserCameraOpen(false);
    setUserCameraLive(false);
  };

  const pickPreferredExternalCamera = (devices: MediaDeviceInfo[]) => {
    if (!devices.length) return '';
    const externalKeywords = ['usb', 'webcam', 'logitech', 'external', 'hd pro'];
    const integratedKeywords = ['integrated', 'internal', 'built-in', 'facetime', 'default'];

    const externalDevice = devices.find((device) => {
      const label = String(device.label || '').toLowerCase();
      const hasExternalKeyword = externalKeywords.some((keyword) => label.includes(keyword));
      const hasIntegratedKeyword = integratedKeywords.some((keyword) => label.includes(keyword));
      return hasExternalKeyword && !hasIntegratedKeyword;
    });

    if (externalDevice) return externalDevice.deviceId;
    if (devices.length > 1) return devices[devices.length - 1].deviceId;
    return devices[0].deviceId;
  };

  const loadUserVideoDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [] as MediaDeviceInfo[];
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === 'videoinput');
    setUserVideoDevices(cameras);

    if (!userSelectedDeviceId || !cameras.some((camera) => camera.deviceId === userSelectedDeviceId)) {
      setUserSelectedDeviceId(pickPreferredExternalCamera(cameras));
    }

    return cameras;
  };

  useEffect(() => {
    loadUserVideoDevices().catch(() => {
      setUserVideoDevices([]);
    });

    return () => {
      stopUserCamera();
      if (userAvatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(userAvatarPreview);
      }
    };
  }, [userAvatarPreview]);

  const attachAndPlayUserStream = async (stream: MediaStream) => {
    if (!userVideoRef.current) return false;
    const video = userVideoRef.current;
    video.srcObject = stream;

    try {
      await video.play();
    } catch {
      return false;
    }

    const hasLiveTrack = stream.getVideoTracks().some((track) => track.readyState === 'live');
    return hasLiveTrack;
  };

  const openPreferredUserCameraStream = async () => {
    let cameras = await loadUserVideoDevices();

    if (!cameras.length || cameras.every((camera) => !camera.label)) {
      const warmupStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      warmupStream.getTracks().forEach((track) => track.stop());
      cameras = await loadUserVideoDevices();
    }

    const preferredDeviceId = userSelectedDeviceId || pickPreferredExternalCamera(cameras);
    const primaryConstraints: MediaStreamConstraints = {
      video: preferredDeviceId
        ? {
            deviceId: { ideal: preferredDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
      audio: false,
    };

    try {
      return await navigator.mediaDevices.getUserMedia(primaryConstraints);
    } catch {
      return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
  };

  const startUserCamera = async () => {
    try {
      setUserCameraError('');
      stopUserCamera();
      setUserCameraOpen(true);
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

      const stream = await openPreferredUserCameraStream();
      const started = await attachAndPlayUserStream(stream);
      if (!started) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('camera_not_started');
      }

      userStreamRef.current = stream;
      setUserCameraLive(stream.getVideoTracks().some((track) => track.readyState === 'live'));
    } catch (error: any) {
      const errorName = String(error?.name || '');
      if (errorName === 'NotReadableError') {
        setUserCameraError('Камера занята (используется другой программой). Закройте её и повторите попытку');
      } else if (errorName === 'NotAllowedError') {
        setUserCameraError('Доступ к камере запрещён. Разрешите доступ в браузере.');
      } else if (errorName === 'NotFoundError') {
        setUserCameraError('Камера не найдена.');
      } else {
        setUserCameraError('Не удалось открыть камеру.');
      }
      setUserCameraOpen(false);
      setUserCameraLive(false);
    }
  };

  const handleUserCameraDeviceChange = async (nextDeviceId: string) => {
    setUserSelectedDeviceId(nextDeviceId);
    if (!userCameraOpen) return;

    try {
      setUserCameraError('');
      stopUserCamera();
      setUserCameraOpen(true);
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

      const stream = await openPreferredUserCameraStream();
      const started = await attachAndPlayUserStream(stream);
      if (!started) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('camera_not_started');
      }

      userStreamRef.current = stream;
      setUserCameraLive(stream.getVideoTracks().some((track) => track.readyState === 'live'));
    } catch {
      setUserCameraError('Выбранная камера не запустилась');
      setUserCameraOpen(false);
      setUserCameraLive(false);
    }
  };

  const handleUserAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setUserAvatarFile(file);

    if (userAvatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(userAvatarPreview);
    }

    if (file) {
      setUserAvatarPreview(URL.createObjectURL(file));
    }
  };

  const captureUserAvatarFromCamera = () => {
    if (!userVideoRef.current || !userCanvasRef.current) return;

    const video = userVideoRef.current;
    const canvas = userCanvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setUserAvatarPreview(imageDataUrl);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `user-camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setUserAvatarFile(file);
      toast.success('Фото с камеры выбрано');
    }, 'image/jpeg', 0.92);
  };

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

  const handleCreateSection = async (event: FormEvent) => {
    event.preventDefault();
    if (!sectionDepartmentId || !sectionName.trim()) {
      toast.warning('Выберите цех и укажите название отдела');
      return;
    }

    try {
      if (editingSectionId !== null) {
        const response = await axioss.put(`/settings/sections/${editingSectionId}/`, {
          department: Number(sectionDepartmentId),
          name: sectionName.trim(),
        });
        setSections((prev) => prev.map((entry) => (entry.id === editingSectionId ? response.data : entry)));
        toast.success('Отдел обновлен');
        setEditingSectionId(null);
      } else {
        const response = await axioss.post('/settings/sections/', {
          department: Number(sectionDepartmentId),
          name: sectionName.trim(),
        });
        setSections((prev) => [...prev, response.data]);
        toast.success('Отдел добавлен');
      }
      setSectionDepartmentId('');
      setSectionName('');
    } catch (error) {
      toast.error(getBackendError(error, editingSectionId !== null ? 'Ошибка при обновлении отдела' : 'Ошибка при добавлении отдела'));
    }
  };

  const handleCreateProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!productName.trim()) {
      toast.warning('Укажите название СИЗ');
      return;
    }

    try {
      if (editingProductId !== null) {
        const currentProduct = products.find((item) => item.id === editingProductId);
        const response = await axioss.put(`/settings/ppe-products/${editingProductId}/`, {
          name: productName.trim(),
          renewal_months: Number(productRenewalMonths || 0),
          type_product: productType,
          is_active: currentProduct?.is_active ?? true,
        });
        setProducts((prev) => prev.map((entry) => (entry.id === editingProductId ? response.data : entry)));
        toast.success('СИЗ обновлен');
        setEditingProductId(null);
      } else {
        const response = await axioss.post('/settings/ppe-products/', {
          name: productName.trim(),
          renewal_months: Number(productRenewalMonths || 0),
          type_product: productType,
          is_active: true,
        });
        setProducts((prev) => [...prev, response.data]);
        toast.success('Средство индивидуальной защиты добавлено');
      }
      setProductName('');
      setProductRenewalMonths('');
      setProductType('ШТ');
    } catch (error) {
      toast.error(getBackendError(error, editingProductId !== null ? 'Ошибка при обновлении СИЗ' : 'Ошибка при добавлении СИЗ'));
    }
  };

  const handleCreatePerson = async (event: FormEvent) => {
    event.preventDefault();
    if (!personFullName.trim() || !personPosition.trim()) {
      toast.warning('ФИО и должность ответственного лица обязательны');
      return;
    }

    try {
      if (editingPersonId !== null) {
        const response = await axioss.put(`/settings/responsible-persons/${editingPersonId}/`, {
          full_name: personFullName.trim(),
          position: personPosition.trim(),
        });
        setPersons((prev) => prev.map((entry) => (entry.id === editingPersonId ? response.data : entry)));
        toast.success('Ответственное лицо обновлено');
        setEditingPersonId(null);
      } else {
        const response = await axioss.post('/settings/responsible-persons/', {
          full_name: personFullName.trim(),
          position: personPosition.trim(),
        });
        setPersons((prev) => [...prev, response.data]);
        toast.success('Ответственное лицо добавлено');
      }
      setPersonFullName('');
      setPersonPosition('');
    } catch (error) {
      toast.error(getBackendError(error, editingPersonId !== null ? 'Ошибка при обновлении ответственного лица' : 'Ошибка при добавлении ответственного лица'));
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
      setSections((prev) => prev.filter((entry) => entry.department !== item.id));
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

  const handleEditSection = (item: Section) => {
    setEditingSectionId(item.id);
    setSectionDepartmentId(String(item.department || ''));
    setSectionName(item.name || '');
  };

  const handleDeleteSection = async (item: Section) => {
    const isConfirmed = window.confirm(`Удалить отдел "${item.name}"?`);
    if (!isConfirmed) return;

    try {
      await axioss.delete(`/settings/sections/${item.id}/`);
      setSections((prev) => prev.filter((entry) => entry.id !== item.id));
      if (editingSectionId === item.id) {
        setEditingSectionId(null);
        setSectionDepartmentId('');
        setSectionName('');
      }
      toast.success('Отдел удален');
    } catch (error) {
      toast.error(getBackendError(error, 'Ошибка при удалении отдела'));
    }
  };

  const handleEditProduct = (item: PPEProduct) => {
    setEditingProductId(item.id);
    setProductName(item.name || '');
    setProductRenewalMonths(String(item.renewal_months ?? ''));
    setProductType((item.type_product || 'ШТ') as 'Комплект' | 'Пора' | 'ШТ');
  };

  const handleDeleteProduct = async (item: PPEProduct) => {
    const isConfirmed = window.confirm(`Удалить СИЗ "${item.name}"?`);
    if (!isConfirmed) return;

    try {
      await axioss.delete(`/settings/ppe-products/${item.id}/`);
      setProducts((prev) => prev.filter((entry) => entry.id !== item.id));
      if (editingProductId === item.id) {
        setEditingProductId(null);
        setProductName('');
        setProductRenewalMonths('');
        setProductType('ШТ');
      }
      toast.success('СИЗ удален');
    } catch (error) {
      toast.error(getBackendError(error, 'Ошибка при удалении СИЗ'));
    }
  };

  const handleEditPerson = (item: ResponsiblePerson) => {
    setEditingPersonId(item.id);
    setPersonFullName(item.full_name || '');
    setPersonPosition(item.position || '');
  };

  const handleDeletePerson = async (item: ResponsiblePerson) => {
    const isConfirmed = window.confirm(`Удалить запись "${item.full_name}"?`);
    if (!isConfirmed) return;

    try {
      await axioss.delete(`/settings/responsible-persons/${item.id}/`);
      setPersons((prev) => prev.filter((entry) => entry.id !== item.id));
      if (editingPersonId === item.id) {
        setEditingPersonId(null);
        setPersonFullName('');
        setPersonPosition('');
      }
      toast.success('Ответственное лицо удалено');
    } catch (error) {
      toast.error(getBackendError(error, 'Ошибка при удалении ответственного лица'));
    }
  };

  const resetUserForm = () => {
    setEditingUserId(null);
    setUserUsername('');
    setUserPassword('');
    setUserPasswordConfirm('');
    setUserFirstName('');
    setUserLastName('');
    setUserRole('user');
    setUserAvatarFile(null);
    if (userAvatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(userAvatarPreview);
    }
    setUserAvatarPreview('');
    setUserCameraError('');
    stopUserCamera();
  };

  const handleCreateOrUpdateUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!userUsername.trim()) {
      toast.warning('Логин обязателен');
      return;
    }

    if (editingUserId === null && !userPassword.trim()) {
      toast.warning('Пароль обязателен для нового пользователя');
      return;
    }

    if (userPassword.trim() || userPasswordConfirm.trim()) {
      if (!userPassword.trim() || !userPasswordConfirm.trim()) {
        toast.warning('Пароль и подтверждение пароля должны быть заполнены');
        return;
      }
      if (userPassword !== userPasswordConfirm) {
        toast.warning('Пароль и подтверждение пароля не совпадают');
        return;
      }
    }

    try {
      if (editingUserId !== null) {
        const payload = new FormData();
        payload.append('username', userUsername.trim());
        payload.append('first_name', userFirstName.trim());
        payload.append('last_name', userLastName.trim());
        payload.append('role', userRole);
        if (userPassword.trim()) {
          payload.append('password', userPassword);
          payload.append('password_confirm', userPasswordConfirm);
        }
        if (userAvatarFile) {
          payload.append('base_avatar', userAvatarFile);
        }

        const response = await axioss.put(`/users/settings-users/${editingUserId}/`, payload);
        setUsers((prev) => prev.map((entry) => (entry.id === editingUserId ? response.data : entry)));
        toast.success('Пользователь обновлен');
      } else {
        const payload = new FormData();
        payload.append('username', userUsername.trim());
        payload.append('password', userPassword);
        payload.append('password_confirm', userPasswordConfirm);
        payload.append('first_name', userFirstName.trim());
        payload.append('last_name', userLastName.trim());
        payload.append('role', userRole);
        if (userAvatarFile) {
          payload.append('base_avatar', userAvatarFile);
        }

        const response = await axioss.post('/users/settings-users/', payload);
        setUsers((prev) => [...prev, response.data]);
        toast.success('Пользователь добавлен');
      }

      resetUserForm();
    } catch (error) {
      toast.error(getBackendError(error, editingUserId !== null ? 'Ошибка при обновлении пользователя' : 'Ошибка при добавлении пользователя'));
    }
  };

  const handleEditUser = (item: SettingsUser) => {
    setEditingUserId(item.id);
    setUserUsername(item.username || '');
    setUserFirstName(item.first_name || '');
    setUserLastName(item.last_name || '');
    setUserRole((item.role || 'user') as 'admin' | 'warehouse_manager' | 'user');
    setUserPassword('');
    setUserPasswordConfirm('');
    setUserAvatarFile(null);
    if (userAvatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(userAvatarPreview);
    }
    setUserAvatarPreview(item.base_avatar || '');
  };

  const handleDeleteUser = async (item: SettingsUser) => {
    const isConfirmed = window.confirm(`Удалить пользователя "${item.username}"?`);
    if (!isConfirmed) return;

    try {
      await axioss.delete(`/users/settings-users/${item.id}/`);
      setUsers((prev) => prev.filter((entry) => entry.id !== item.id));
      if (editingUserId === item.id) {
        resetUserForm();
      }
      toast.success('Пользователь удален');
    } catch (error) {
      toast.error(getBackendError(error, 'Ошибка при удалении пользователя'));
    }
  };

  return (
    <>
      <Breadcrumb pageName="Настройки" />

      {!canManageSettings ? (
        <div className="rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="text-base text-red-600">Нет доступа к странице</div>
          <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            Только admin или warehouse_manager могут использовать этот раздел.
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {loading && (
            <div className="rounded-sm border border-stroke bg-white p-4 text-sm dark:border-strokedark dark:bg-boxdark">
              Загрузка...
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
              <h3 className="mb-3 text-base font-semibold">Цех</h3>
              <form onSubmit={handleCreateDepartment} className="space-y-3">
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
                <button type="submit" className="rounded bg-primary px-4 py-2 text-white">
                  Добавить
                </button>
              </form>
              <button
                type="button"
                onClick={() => toggleAccordion('departments')}
                className="mt-4 flex w-full items-center justify-between rounded border border-stroke px-3 py-2 text-left text-sm dark:border-strokedark"
              >
                <span>Список ({departments.length})</span>
                <span>{openAccordions.departments ? '▾' : '▸'}</span>
              </button>
              {openAccordions.departments && (
                <div className="mt-2 max-h-48 overflow-auto text-sm">
                  {departments.map((item) => (
                    <div key={item.id} className="border-b border-stroke py-1 dark:border-strokedark">
                      <div className="flex items-center justify-between gap-3">
                        <div>{item.name} — {item.boss_fullName}</div>
                        {role === 'admin' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditDepartment(item)}
                              className="inline-flex items-center gap-1 rounded border border-stroke px-2 py-0.5 text-xs dark:border-strokedark"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 20H8L18.5 9.5C19.3 8.7 19.3 7.3 18.5 6.5L17.5 5.5C16.7 4.7 15.3 4.7 14.5 5.5L4 16V20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDepartment(item)}
                              className="inline-flex items-center gap-1 rounded border border-red-400 px-2 py-0.5 text-xs text-red-600"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M8 6V4H16V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M19 6L18 20H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
              <h3 className="mb-3 text-base font-semibold">Отдел</h3>
              <form onSubmit={handleCreateSection} className="space-y-3">
                <select
                  value={sectionDepartmentId}
                  onChange={(e) => setSectionDepartmentId(e.target.value)}
                  className="w-full rounded border border-stroke bg-transparent px-3 py-2 dark:border-strokedark dark:bg-transparent"
                >
                  <option value="">Выберите цех</option>
                  {departments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <input
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  placeholder="Название отдела"
                  className="w-full rounded border border-stroke bg-transparent px-3 py-2 dark:border-strokedark dark:bg-transparent"
                />
                <button type="submit" className="rounded bg-primary px-4 py-2 text-white">
                  Добавить
                </button>
              </form>
              <button
                type="button"
                onClick={() => toggleAccordion('sections')}
                className="mt-4 flex w-full items-center justify-between rounded border border-stroke px-3 py-2 text-left text-sm dark:border-strokedark"
              >
                <span>Список ({sections.length})</span>
                <span>{openAccordions.sections ? '▾' : '▸'}</span>
              </button>
              {openAccordions.sections && (
                <div className="mt-2 max-h-48 overflow-auto text-sm">
                  {sections.map((item) => (
                    <div key={item.id} className="border-b border-stroke py-1 dark:border-strokedark">
                      <div className="flex items-center justify-between gap-3">
                        <div>{item.department_name} — {item.name}</div>
                        {role === 'admin' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditSection(item)}
                              className="inline-flex items-center gap-1 rounded border border-stroke px-2 py-0.5 text-xs dark:border-strokedark"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 20H8L18.5 9.5C19.3 8.7 19.3 7.3 18.5 6.5L17.5 5.5C16.7 4.7 15.3 4.7 14.5 5.5L4 16V20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSection(item)}
                              className="inline-flex items-center gap-1 rounded border border-red-400 px-2 py-0.5 text-xs text-red-600"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M8 6V4H16V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M19 6L18 20H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
              <h3 className="mb-3 text-base font-semibold">Средство индивидуальной защиты</h3>
              <form onSubmit={handleCreateProduct} className="space-y-3">
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Название СИЗ"
                  className="w-full rounded border border-stroke bg-transparent px-3 py-2 dark:border-strokedark dark:bg-transparent"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    min={0}
                    value={productRenewalMonths}
                    onChange={(e) => setProductRenewalMonths(e.target.value)}
                    placeholder="Срок обновления (в месяцах)"
                    className="w-full rounded border border-stroke bg-transparent px-3 py-2 dark:border-strokedark dark:bg-transparent"
                  />
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value as 'Комплект' | 'Пора' | 'ШТ')}
                    className="w-full rounded border border-stroke bg-transparent px-3 py-2 dark:border-strokedark dark:bg-transparent"
                  >
                    <option value="ШТ">ШТ</option>
                    <option value="Комплект">Комплект</option>
                    <option value="Пора">Пора</option>
                  </select>
                </div>
                <button type="submit" className="rounded bg-primary px-4 py-2 text-white">
                  Добавить
                </button>
              </form>
              <button
                type="button"
                onClick={() => toggleAccordion('products')}
                className="mt-4 flex w-full items-center justify-between rounded border border-stroke px-3 py-2 text-left text-sm dark:border-strokedark"
              >
                <span>Список ({products.length})</span>
                <span>{openAccordions.products ? '▾' : '▸'}</span>
              </button>
              {openAccordions.products && (
                <div className="mt-2 max-h-48 overflow-auto text-sm">
                  {products.map((item) => (
                    <div key={item.id} className="border-b border-stroke py-1 dark:border-strokedark">
                      <div className="flex items-center justify-between gap-3">
                        <div>{item.name} — {item.renewal_months} мес. — {item.type_product}</div>
                        {role === 'admin' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditProduct(item)}
                              className="inline-flex items-center gap-1 rounded border border-stroke px-2 py-0.5 text-xs dark:border-strokedark"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 20H8L18.5 9.5C19.3 8.7 19.3 7.3 18.5 6.5L17.5 5.5C16.7 4.7 15.3 4.7 14.5 5.5L4 16V20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(item)}
                              className="inline-flex items-center gap-1 rounded border border-red-400 px-2 py-0.5 text-xs text-red-600"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M8 6V4H16V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M19 6L18 20H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
              <h3 className="mb-3 text-base font-semibold">Ответственное лицо</h3>
              <form onSubmit={handleCreatePerson} className="space-y-3">
                <input
                  value={personFullName}
                  onChange={(e) => setPersonFullName(e.target.value)}
                  placeholder="ФИО"
                  className="w-full rounded border border-stroke bg-transparent px-3 py-2 dark:border-strokedark dark:bg-transparent"
                />
                <input
                  value={personPosition}
                  onChange={(e) => setPersonPosition(e.target.value)}
                  placeholder="Должность"
                  className="w-full rounded border border-stroke bg-transparent px-3 py-2 dark:border-strokedark dark:bg-transparent"
                />
                <button type="submit" className="rounded bg-primary px-4 py-2 text-white">
                  Добавить
                </button>
              </form>
              <button
                type="button"
                onClick={() => toggleAccordion('persons')}
                className="mt-4 flex w-full items-center justify-between rounded border border-stroke px-3 py-2 text-left text-sm dark:border-strokedark"
              >
                <span>Список ({persons.length})</span>
                <span>{openAccordions.persons ? '▾' : '▸'}</span>
              </button>
              {openAccordions.persons && (
                <div className="mt-2 max-h-48 overflow-auto text-sm">
                  {persons.map((item) => (
                    <div key={item.id} className="border-b border-stroke py-1 dark:border-strokedark">
                      <div className="flex items-center justify-between gap-3">
                        <div>{item.position} — {item.full_name}</div>
                        {role === 'admin' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditPerson(item)}
                              className="inline-flex items-center gap-1 rounded border border-stroke px-2 py-0.5 text-xs dark:border-strokedark"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 20H8L18.5 9.5C19.3 8.7 19.3 7.3 18.5 6.5L17.5 5.5C16.7 4.7 15.3 4.7 14.5 5.5L4 16V20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePerson(item)}
                              className="inline-flex items-center gap-1 rounded border border-red-400 px-2 py-0.5 text-xs text-red-600"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M8 6V4H16V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M19 6L18 20H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {role === 'admin' && (
              <div className="rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark xl:col-span-2">
                <h3 className="mb-3 text-base font-semibold">Пользователи</h3>
                <form onSubmit={handleCreateOrUpdateUser} className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input
                      value={userUsername}
                      onChange={(e) => setUserUsername(e.target.value)}
                      placeholder="Логин"
                      className="w-full rounded border border-stroke bg-transparent px-3 py-2 dark:border-strokedark dark:bg-transparent"
                    />
                    <input
                      value={userFirstName}
                      onChange={(e) => setUserFirstName(e.target.value)}
                      placeholder="Имя"
                      className="w-full rounded border border-stroke bg-transparent px-3 py-2 dark:border-strokedark dark:bg-transparent"
                    />
                    <input
                      value={userLastName}
                      onChange={(e) => setUserLastName(e.target.value)}
                      placeholder="Фамилия"
                      className="w-full rounded border border-stroke bg-transparent px-3 py-2 dark:border-strokedark dark:bg-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input
                      type="password"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      placeholder={editingUserId !== null ? 'Новый пароль (необязательно)' : 'Пароль'}
                      className="w-full rounded border border-stroke bg-transparent px-3 py-2 dark:border-strokedark dark:bg-transparent"
                    />
                    <input
                      type="password"
                      value={userPasswordConfirm}
                      onChange={(e) => setUserPasswordConfirm(e.target.value)}
                      placeholder={editingUserId !== null ? 'Подтверждение нового пароля' : 'Подтверждение пароля'}
                      className="w-full rounded border border-stroke bg-transparent px-3 py-2 dark:border-strokedark dark:bg-transparent"
                    />
                    <select
                      value={userRole}
                      onChange={(e) => setUserRole(e.target.value as 'admin' | 'warehouse_manager' | 'user')}
                      className="w-full rounded border border-stroke bg-transparent px-3 py-2 dark:border-strokedark dark:bg-transparent"
                    >
                      <option value="user">Пользователь</option>
                      <option value="warehouse_manager">Кладовщик</option>
                      <option value="admin">Администратор</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="rounded bg-primary px-4 py-2 text-white">
                      {editingUserId !== null ? 'Сохранить' : 'Добавить'}
                    </button>
                    {editingUserId !== null && (
                      <button type="button" onClick={resetUserForm} className="rounded border border-stroke px-4 py-2 dark:border-strokedark">
                        Отмена
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="mb-3 block text-black dark:text-white">Базовое фото 3x4</label>
                    <div className="grid gap-3 sm:grid-cols-12">
                      <div className="sm:col-span-7">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUserAvatarChange}
                          className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black file:mr-4 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-sm dark:border-form-strokedark dark:bg-form-input dark:text-white"
                        />

                        <div className="mt-2 rounded border p-3">
                          <label className="mb-1 block text-sm text-gray-700">Камера</label>
                          <select
                            value={userSelectedDeviceId}
                            onChange={(event) => handleUserCameraDeviceChange(event.target.value)}
                            className="mb-2 w-full rounded border px-2 py-2 text-sm"
                          >
                            {userVideoDevices.length === 0 ? (
                              <option value="">Камера не найдена</option>
                            ) : (
                              userVideoDevices.map((device, index) => (
                                <option key={device.deviceId || `cam-${index}`} value={device.deviceId}>
                                  {device.label || `Камера ${index + 1}`}
                                </option>
                              ))
                            )}
                          </select>

                          {!userCameraOpen ? (
                            <button
                              type="button"
                              onClick={startUserCamera}
                              className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                            >
                              Открыть камеру
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <video
                                ref={userVideoRef}
                                className="w-full max-w-md rounded border bg-black"
                                autoPlay
                                playsInline
                                muted
                                onPlaying={() => setUserCameraLive(true)}
                                onPause={() => setUserCameraLive(false)}
                                onEmptied={() => setUserCameraLive(false)}
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={captureUserAvatarFromCamera}
                                  disabled={!userCameraLive}
                                  className="rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                                >
                                  Снять фото
                                </button>
                                <button
                                  type="button"
                                  onClick={stopUserCamera}
                                  className="rounded bg-slate-500 px-3 py-2 text-sm text-white hover:bg-slate-600"
                                >
                                  Закрыть камеру
                                </button>
                              </div>
                            </div>
                          )}

                          {userCameraError ? <p className="mt-2 text-xs text-red-600">{userCameraError}</p> : null}
                          <canvas ref={userCanvasRef} className="hidden" />
                        </div>
                      </div>

                      <div className="sm:col-span-5">
                        <div className="h-full rounded border p-3">
                          <div className="mb-2 text-sm text-gray-600">Текущее фото</div>
                          {userAvatarPreview ? (
                            <div className="mx-auto h-56 w-40 rounded border bg-black/5 p-1">
                              <img
                                src={userAvatarPreview}
                                alt="user-avatar-preview"
                                className="h-full w-full rounded object-contain bg-black"
                              />
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">Фото не выбрано</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </form>

                <button
                  type="button"
                  onClick={() => toggleAccordion('users')}
                  className="mt-4 flex w-full items-center justify-between rounded border border-stroke px-3 py-2 text-left text-sm dark:border-strokedark"
                >
                  <span>Список ({users.length})</span>
                  <span>{openAccordions.users ? '▾' : '▸'}</span>
                </button>
                {openAccordions.users && (
                  <div className="mt-2 max-h-64 overflow-auto text-sm">
                    {users.map((item) => (
                      <div key={item.id} className="border-b border-stroke py-2 dark:border-strokedark">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">{item.username} ({item.role})</div>
                            <div className="text-xs text-slate-500">{item.first_name} {item.last_name}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditUser(item)}
                              className="inline-flex items-center gap-1 rounded border border-stroke px-2 py-0.5 text-xs dark:border-strokedark"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 20H8L18.5 9.5C19.3 8.7 19.3 7.3 18.5 6.5L17.5 5.5C16.7 4.7 15.3 4.7 14.5 5.5L4 16V20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(item)}
                              className="inline-flex items-center gap-1 rounded border border-red-400 px-2 py-0.5 text-xs text-red-600"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M8 6V4H16V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M19 6L18 20H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default NastroykaPage;
