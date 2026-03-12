import Breadcrumb from '../../components/Breadcrumbs/Breadcrumb';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import axioss from '../../api/axios';

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

const UserPage = () => {
  const navigate = useNavigate();
  const role = useMemo(() => normalizeRole(localStorage.getItem('role')), []);
  const isAdmin = role === 'admin';

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<SettingsUser[]>([]);

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

  const userVideoRef = useRef<HTMLVideoElement | null>(null);
  const userCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const userStreamRef = useRef<MediaStream | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await axioss.get('/users/settings-users/');
      setUsers(response.data || []);
    } catch (error) {
      toast.error(getBackendError(error, 'Не удалось загрузить данные'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    loadUsers();
  }, [isAdmin]);

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
  }, []);

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

  if (!isAdmin) {
    return (
      <>
        <Breadcrumb pageName="Пользователи" />
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
      <Breadcrumb pageName="Пользователи" />

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
          <form onSubmit={handleCreateOrUpdateUser} className="mb-6 space-y-3">
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
                        <img src={userAvatarPreview} alt="user-avatar-preview" className="h-full w-full rounded object-contain bg-black" />
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">Фото не выбрано</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </form>

          <div className="max-h-96 overflow-auto">
            {users.length === 0 ? (
              <p className="text-center text-gray-500">Нет данных</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Логин</th>
                    <th className="px-3 py-2 text-left font-semibold">Роль</th>
                    <th className="px-3 py-2 text-left font-semibold">Имя</th>
                    <th className="px-3 py-2 text-left font-semibold">Фамилия</th>
                    <th className="px-3 py-2 text-left font-semibold">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id} className="border-t border-stroke dark:border-strokedark">
                      <td className="px-3 py-2 font-medium">{item.username}</td>
                      <td className="px-3 py-2">{item.role}</td>
                      <td className="px-3 py-2">{item.first_name}</td>
                      <td className="px-3 py-2">{item.last_name}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleEditUser(item)} className="rounded border border-stroke px-2 py-1 text-xs dark:border-strokedark">
                            Изменить
                          </button>
                          <button onClick={() => handleDeleteUser(item)} className="rounded border border-red-400 px-2 py-1 text-xs text-red-600">
                            Удалить
                          </button>
                        </div>
                      </td>
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

export default UserPage;
