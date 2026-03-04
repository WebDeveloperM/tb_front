import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Calendar } from 'primereact/calendar';
import { toast } from 'react-toastify';
import { FaLongArrowAltLeft } from 'react-icons/fa';
import { IoIosSave } from 'react-icons/io';
import { FiUpload } from 'react-icons/fi';
import Breadcrumb from '../../components/Breadcrumbs/Breadcrumb';
import { isAuthenticated } from '../../utils/auth';
import axioss from '../../api/axios';
import { BASE_URL } from '../../utils/urls';
import { ModalDataInput } from '../../components/Input/ModalDataInput';

type DepartmentOption = {
  id: number;
  name: string;
  boss_fullName?: string;
};

type SectionOption = {
  id: number;
  name: string;
  department_id: number;
};

type AddEmployeeMetaResponse = {
  departments?: DepartmentOption[];
  sections?: SectionOption[];
};

const REQUIRED_MESSAGE = 'Это поле обязательно';

const initialForm = {
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
};

type FormState = typeof initialForm;
type FormKey = keyof FormState;

const toApiDate = (value: Date | null) => {
  if (!value) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toCalendarDate = (value?: string) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const AddEmployeePage = () => {
  const navigate = useNavigate();
  const role = localStorage.getItem('role') || 'user';
  const canEdit = role === 'admin' || role === 'warehouse_manager';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingTabelNumber, setCheckingTabelNumber] = useState(false);
  const [lastDuplicateNotifiedTabel, setLastDuplicateNotifiedTabel] = useState('');
  const [baseImageFile, setBaseImageFile] = useState<File | null>(null);
  const [baseImagePreview, setBaseImagePreview] = useState('');
  const [baseImageError, setBaseImageError] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLive, setCameraLive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [form, setForm] = useState<FormState>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormKey, string>>>({});

  const requiredFieldLabels: Array<{ key: FormKey; label: string }> = [
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

  const updateFormField = (key: FormKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key] || !String(value ?? '').trim()) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const renderFieldError = (key: FormKey) => {
    if (!fieldErrors[key]) return null;
    return <p className="mt-1 text-xs text-red-600">{fieldErrors[key]}</p>;
  };

  useEffect(() => {
    setLoading(true);
    axioss
      .get(`${BASE_URL}/add-employee/`)
      .then((response) => {
        const payload = response.data as AddEmployeeMetaResponse;
        setDepartments(payload.departments || []);
        setSections(payload.sections || []);
      })
      .catch(() => toast.error('Ошибка загрузки данных формы.'))
      .finally(() => setLoading(false));
  }, []);

  const filteredSections = useMemo(() => {
    if (!form.department) return [];
    return sections.filter((section) => Number(section.department_id) === Number(form.department));
  }, [sections, form.department]);

  const selectedDepartmentBoss = useMemo(() => {
    const selectedDepartment = departments.find((department) => Number(department.id) === Number(form.department));
    return selectedDepartment?.boss_fullName || '-';
  }, [departments, form.department]);

  const handleTabelNumberBlur = async () => {
    const tabelNumber = form.tabel_number.trim();
    if (!tabelNumber) return;

    setCheckingTabelNumber(true);
    try {
      const response = await axioss.get(`${BASE_URL}/add-employee/`, {
        params: { tabel_number: tabelNumber },
      });

      const exists = Boolean(response.data?.tabel_number_exists);
      if (exists) {
        const duplicateMessage = 'Такой табельный номер уже существует';
        setFieldErrors((prev) => ({ ...prev, tabel_number: duplicateMessage }));

        if (lastDuplicateNotifiedTabel !== tabelNumber) {
          toast.error(duplicateMessage);
          setLastDuplicateNotifiedTabel(tabelNumber);
        }
        return;
      }

      setFieldErrors((prev) => {
        if (!prev.tabel_number) return prev;
        const next = { ...prev };
        delete next.tabel_number;
        return next;
      });
      if (lastDuplicateNotifiedTabel === tabelNumber) {
        setLastDuplicateNotifiedTabel('');
      }
    } catch {
      toast.error('Не удалось проверить табельный номер');
    } finally {
      setCheckingTabelNumber(false);
    }
  };

  const handleSave = async () => {
    const nextErrors: Partial<Record<FormKey, string>> = {};
    requiredFieldLabels.forEach((field) => {
      const value = form[field.key];
      if (!String(value ?? '').trim()) {
        nextErrors[field.key] = REQUIRED_MESSAGE;
      }
    });

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error('Заполните обязательные поля');
      return;
    }

    if (!baseImageFile) {
      setBaseImageError(REQUIRED_MESSAGE);
      toast.error('Загрузите базовое фото сотрудника 3x4');
      return;
    }

    setBaseImageError('');

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('first_name', form.first_name.trim());
      formData.append('last_name', form.last_name.trim());
      formData.append('surname', form.surname.trim());
      formData.append('tabel_number', form.tabel_number.trim());
      formData.append('position', form.position.trim());
      formData.append('gender', form.gender);
      formData.append('height', form.height.trim());
      formData.append('clothe_size', form.clothe_size.trim());
      formData.append('shoe_size', form.shoe_size.trim());
      formData.append('headdress_size', form.headdress_size.trim());
      formData.append('date_of_employment', form.date_of_employment);
      if (form.date_of_change_position) {
        formData.append('date_of_change_position', form.date_of_change_position);
      }
      formData.append('department', form.department);
      formData.append('section', form.section);
      formData.append('base_image', baseImageFile);

      const response = await axioss.post(`${BASE_URL}/add-employee/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const createdSlug = response.data?.slug;

      toast.success('Сотрудник успешно добавлен');

      if (createdSlug) {
        navigate(`/item-view/${createdSlug}`);
        return;
      }

      navigate('/');
    } catch (error: any) {
      const apiData = error?.response?.data;
      const tabelNumberError = apiData?.tabel_number;
      if (tabelNumberError) {
        const duplicateMessage = Array.isArray(tabelNumberError)
          ? String(tabelNumberError[0] || 'Такой табельный номер уже существует')
          : String(tabelNumberError);
        setFieldErrors((prev) => ({ ...prev, tabel_number: duplicateMessage }));
        toast.error('Такой табельный номер уже существует');
        return;
      }

      const firstError = apiData && typeof apiData === 'object' ? Object.values(apiData)[0] : null;
      const message =
        (Array.isArray(firstError) ? firstError[0] : firstError) ||
        apiData?.detail ||
        apiData?.error ||
        'Ошибка при сохранении данных';
      toast.error(String(message));
    } finally {
      setSaving(false);
    }
  };

  const handleImportExcelClick = () => {
    if (isImporting) return;
    importFileInputRef.current?.click();
  };

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile) return;

    const isExcelFile = /\.(xlsx|xls)$/i.test(selectedFile.name);
    if (!isExcelFile) {
      toast.error('Файл должен быть формата .xlsx или .xls');
      return;
    }

    try {
      setIsImporting(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await axioss.post(`${BASE_URL}/import-employees/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const created = Number(response.data?.created || 0);
      const updated = Number(response.data?.updated || 0);
      const skipped = Number(response.data?.skipped || 0);
      const errors: string[] = Array.isArray(response.data?.errors) ? response.data.errors : [];

      toast.success(`Импорт завершен. Добавлено: ${created}, обновлено: ${updated}, пропущено: ${skipped}`);
      if (errors.length > 0) {
        toast.warning(`Есть ошибки в ${errors.length} строках. Проверьте формат Excel.`);
      }

      navigate('/');
    } catch (error: any) {
      const backendError = error?.response?.data?.error;
      toast.error(backendError || 'Ошибка при импорте Excel');
    } finally {
      setIsImporting(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOpen(false);
    setCameraLive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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

  const loadVideoDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [] as MediaDeviceInfo[];
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === 'videoinput');
    setVideoDevices(cameras);

    if (!selectedDeviceId || !cameras.some((camera) => camera.deviceId === selectedDeviceId)) {
      setSelectedDeviceId(pickPreferredExternalCamera(cameras));
    }

    return cameras;
  };

  useEffect(() => {
    loadVideoDevices().catch(() => {
      setVideoDevices([]);
    });
  }, []);

  const attachAndPlayStream = async (stream: MediaStream) => {
    if (!videoRef.current) return false;
    const video = videoRef.current;
    video.srcObject = stream;

    try {
      await video.play();
    } catch {
      return false;
    }

    const hasLiveTrack = stream.getVideoTracks().some((track) => track.readyState === 'live');
    return hasLiveTrack;
  };

  const openPreferredCameraStream = async () => {
    let cameras = await loadVideoDevices();

    if (!cameras.length || cameras.every((camera) => !camera.label)) {
      const warmupStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      warmupStream.getTracks().forEach((track) => track.stop());
      cameras = await loadVideoDevices();
    }

    const preferredDeviceId = selectedDeviceId || pickPreferredExternalCamera(cameras);
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

  const startCamera = async () => {
    try {
      setCameraError('');
      stopCamera();
      setCameraOpen(true);
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

      const stream = await openPreferredCameraStream();
      const started = await attachAndPlayStream(stream);
      if (!started) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('camera_not_started');
      }

      streamRef.current = stream;
      setCameraLive(stream.getVideoTracks().some((track) => track.readyState === 'live'));
    } catch (error: any) {
      const errorName = String(error?.name || '');
      if (errorName === 'NotReadableError') {
        setCameraError('Kamera band (boshqa dastur ishlatyapti). Uni yopib qayta urinib ko‘ring');
      } else if (errorName === 'NotAllowedError') {
        setCameraError('Камерага рухсат берилмаган. Browser рухсатини текширинг');
      } else if (errorName === 'NotFoundError') {
        setCameraError('Камера қурилмаси топилмади');
      } else {
        setCameraError('Камера очилмади. Қурилма ёки браузер созламаларини текширинг');
      }
      setCameraOpen(false);
      setCameraLive(false);
    }
  };

  const handleCameraDeviceChange = async (nextDeviceId: string) => {
    setSelectedDeviceId(nextDeviceId);
    if (!cameraOpen) return;

    try {
      setCameraError('');
      stopCamera();
      setCameraOpen(true);
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

      const stream = await openPreferredCameraStream();
      const started = await attachAndPlayStream(stream);
      if (!started) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('camera_not_started');
      }

      streamRef.current = stream;
      setCameraLive(stream.getVideoTracks().some((track) => track.readyState === 'live'));
    } catch {
      setCameraError('Танланган камера ишга тушмади');
      setCameraOpen(false);
      setCameraLive(false);
    }
  };

  const capturePhotoFromCamera = () => {
    if (!videoRef.current || !cameraCanvasRef.current) return;

    const video = videoRef.current;
    const canvas = cameraCanvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setBaseImagePreview(imageDataUrl);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `employee-camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setBaseImageFile(file);
      setBaseImageError('');
      toast.success('Фото с камеры выбрано');
    }, 'image/jpeg', 0.92);
  };

  if (!isAuthenticated()) {
    return <Navigate to="/auth/signin" />;
  }

  if (!canEdit) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Breadcrumb pageName="Добавить сотрудника" />

      <div className="grid grid-cols-1 sm:grid-cols-4">
        <div className="col-span-4">
          <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="border-b border-stroke py-4 px-6.5 dark:border-strokedark flex items-center justify-between gap-3">
              <h3 className="font-medium text-black dark:text-white">Добавить сотрудника</h3>
              <div className="flex items-center gap-2">
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleImportFileChange}
                />
                <button
                  type="button"
                  onClick={handleImportExcelClick}
                  disabled={isImporting}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white transition-colors duration-200 ${
                    isImporting ? 'bg-gray-400 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700'
                  }`}
                  title="Импорт сотрудников из Excel"
                >
                  {isImporting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <FiUpload className="w-4 h-4" />
                      <span>Импорт Excel</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-6.5">
              {loading ? (
                <div>Загрузка...</div>
              ) : (
                <>
                  <h1 className="pb-3 font-semibold">Сотрудник</h1>
                  <div className="grid sm:grid-cols-12 gap-4 border-b pb-6 mb-5">
                    <div className="col-span-2">
                      <label className="mb-3 block text-black dark:text-white">Фамилия</label>
                      <input
                        value={form.last_name}
                        onChange={(e) => updateFormField('last_name', e.target.value)}
                        className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      />
                      {renderFieldError('last_name')}
                    </div>
                    <div className="col-span-2">
                      <label className="mb-3 block text-black dark:text-white">Имя</label>
                      <input
                        value={form.first_name}
                        onChange={(e) => updateFormField('first_name', e.target.value)}
                        className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      />
                      {renderFieldError('first_name')}
                    </div>
                    <div className="col-span-2">
                      <label className="mb-3 block text-black dark:text-white">Отчество</label>
                      <input
                        value={form.surname}
                        onChange={(e) => updateFormField('surname', e.target.value)}
                        className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      />
                      {renderFieldError('surname')}
                    </div>
                    <div className="col-span-2">
                      <label className="mb-3 block text-black dark:text-white">Табельный номер</label>
                      <input
                        value={form.tabel_number}
                        onChange={(e) => updateFormField('tabel_number', e.target.value)}
                        onBlur={handleTabelNumberBlur}
                        className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      />
                      {checkingTabelNumber && <p className="mt-1 text-xs text-gray-500">Проверка...</p>}
                      {renderFieldError('tabel_number')}
                    </div>
                    <div className="col-span-4">
                      <label className="mb-3 block text-black dark:text-white">Должность</label>
                      <input
                        value={form.position}
                        onChange={(e) => updateFormField('position', e.target.value)}
                        className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      />
                      {renderFieldError('position')}
                    </div>

                    <div className="col-span-3">
                      <label className="mb-3 block text-black dark:text-white">Цех</label>
                      <select
                        value={form.department}
                        onChange={(e) => {
                          const nextDepartment = e.target.value;
                          updateFormField('department', nextDepartment);
                          setForm((prev) => ({ ...prev, section: '' }));
                          setFieldErrors((prev) => {
                            if (!prev.section) return prev;
                            const next = { ...prev };
                            delete next.section;
                            return next;
                          });
                        }}
                        className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      >
                        <option value="">Выберите цех</option>
                        {departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                      {renderFieldError('department')}
                    </div>
                    <div className="col-span-3">
                      <label className="mb-3 block text-black dark:text-white">Отдел</label>
                      <select
                        value={form.section}
                        onChange={(e) => updateFormField('section', e.target.value)}
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
                      {renderFieldError('section')}
                    </div>
                    <ModalDataInput label="Руководитель цеха" inputData={selectedDepartmentBoss} wrapperClassName="col-span-3" />

                    <div className="col-span-6">
                      <label className="mb-3 block text-black dark:text-white">Базовое фото 3x4</label>
                      <div className="grid gap-3 sm:grid-cols-12">
                        <div className="sm:col-span-7">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setBaseImageFile(file);
                              if (file) {
                                setBaseImageError('');
                                setBaseImagePreview(URL.createObjectURL(file));
                              }
                            }}
                            className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black file:mr-4 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-sm dark:border-form-strokedark dark:bg-form-input dark:text-white"
                          />

                          <div className="mt-2 rounded border p-3">
                            <label className="mb-1 block text-sm text-gray-700">Камера</label>
                            <select
                              value={selectedDeviceId}
                              onChange={(e) => handleCameraDeviceChange(e.target.value)}
                              className="mb-2 w-full rounded border px-2 py-2 text-sm"
                            >
                              {videoDevices.length === 0 ? (
                                <option value="">Камера не найдена</option>
                              ) : (
                                videoDevices.map((device, index) => (
                                  <option key={device.deviceId || `cam-${index}`} value={device.deviceId}>
                                    {device.label || `Камера ${index + 1}`}
                                  </option>
                                ))
                              )}
                            </select>

                            {!cameraOpen ? (
                              <button
                                type="button"
                                onClick={startCamera}
                                className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                              >
                                Открыть камеру
                              </button>
                            ) : (
                              <div className="space-y-2">
                                <video
                                  ref={videoRef}
                                  className="w-full rounded border bg-black"
                                  autoPlay
                                  playsInline
                                  muted
                                  onPlaying={() => setCameraLive(true)}
                                  onPause={() => setCameraLive(false)}
                                  onEmptied={() => setCameraLive(false)}
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={capturePhotoFromCamera}
                                    disabled={!cameraLive}
                                    className="rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                                  >
                                    Снять фото
                                  </button>
                                  <button
                                    type="button"
                                    onClick={stopCamera}
                                    className="rounded bg-slate-500 px-3 py-2 text-sm text-white hover:bg-slate-600"
                                  >
                                    Закрыть камеру
                                  </button>
                                </div>
                                <div className={`text-xs ${cameraLive ? 'text-green-600' : 'text-gray-500'}`}>
                                  {cameraLive ? 'Камера работает' : 'Камера не активна'}
                                </div>
                              </div>
                            )}

                            {cameraError ? <p className="mt-2 text-xs text-red-600">{cameraError}</p> : null}
                            <canvas ref={cameraCanvasRef} className="hidden" />
                          </div>
                        </div>

                        <div className="sm:col-span-5">
                          <div className="h-full rounded border p-3">
                            <div className="mb-2 text-sm text-gray-600">Текущее фото</div>
                            {baseImagePreview ? (
                              <div className="mx-auto h-56 w-40 rounded border bg-black/5 p-1">
                                <img
                                  src={baseImagePreview}
                                  alt="base_image_preview"
                                  className="h-full w-full rounded object-contain bg-black"
                                />
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500">Rasm yuklanmagan</p>
                            )}
                          </div>
                        </div>
                      </div>
                      {baseImageError ? <p className="mt-1 text-xs text-red-600">{baseImageError}</p> : null}
                    </div>
                  </div>

                  <h1 className="pb-3 font-semibold">Персональные данные</h1>
                  <div className="grid sm:grid-cols-12 gap-4">
                    <div className="col-span-3">
                      <label className="mb-3 block text-black dark:text-white">Пол</label>
                      <select
                        value={form.gender}
                        onChange={(e) => updateFormField('gender', e.target.value)}
                        className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      >
                        <option value="">Выберите пол</option>
                        <option value="M">Мужской</option>
                        <option value="F">Женский</option>
                      </select>
                      {renderFieldError('gender')}
                    </div>
                    <div className="col-span-3">
                      <label className="mb-3 block text-black dark:text-white">Рост</label>
                      <input
                        value={form.height}
                        onChange={(e) => updateFormField('height', e.target.value)}
                        className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      />
                      {renderFieldError('height')}
                    </div>
                    <div className="col-span-3">
                      <label className="mb-3 block text-black dark:text-white">Размер одежды</label>
                      <input
                        value={form.clothe_size}
                        onChange={(e) => updateFormField('clothe_size', e.target.value)}
                        className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      />
                      {renderFieldError('clothe_size')}
                    </div>
                    <div className="col-span-3">
                      <label className="mb-3 block text-black dark:text-white">Размер обуви</label>
                      <input
                        value={form.shoe_size}
                        onChange={(e) => updateFormField('shoe_size', e.target.value)}
                        className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      />
                      {renderFieldError('shoe_size')}
                    </div>
                    <div className="col-span-3">
                      <label className="mb-3 block text-black dark:text-white">Размер головного убора</label>
                      <input
                        value={form.headdress_size}
                        onChange={(e) => updateFormField('headdress_size', e.target.value)}
                        className="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      />
                      {renderFieldError('headdress_size')}
                    </div>
                    <div className="col-span-3">
                      <label className="mb-3 block text-black dark:text-white">Дата приема на работу</label>
                      <Calendar
                        value={toCalendarDate(form.date_of_employment)}
                        onChange={(e) => updateFormField('date_of_employment', toApiDate((e.value as Date) || null))}
                        dateFormat="dd.mm.yy"
                        showIcon
                        className="w-full edit-date-calendar"
                        inputClassName="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      />
                      {renderFieldError('date_of_employment')}
                    </div>
                    <div className="col-span-3">
                      <label className="mb-3 block text-black dark:text-white">Дата последнего изменения должности</label>
                      <Calendar
                        value={toCalendarDate(form.date_of_change_position)}
                        onChange={(e) =>
                          updateFormField('date_of_change_position', toApiDate((e.value as Date) || null))
                        }
                        dateFormat="dd.mm.yy"
                        showIcon
                        className="w-full edit-date-calendar"
                        inputClassName="w-full rounded-md border border-stroke bg-transparent py-2 px-3 text-black dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-between border-t border-stroke pt-4 dark:border-strokedark">
                    <Link
                      to="/"
                      className="flex items-center justify-center gap-2 rounded-md bg-slate-500 py-2 px-3 text-center font-medium text-white hover:bg-opacity-90 lg:px-5 xl:px-5"
                    >
                      <FaLongArrowAltLeft className="text-xl" />
                      Назад
                    </Link>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center justify-center gap-2 rounded-md bg-meta-3 py-2 px-3 text-center font-medium text-white hover:bg-opacity-90 disabled:opacity-70 lg:px-5 xl:px-7"
                    >
                      <IoIosSave className="text-xl" />
                      {saving ? 'Сохранение...' : 'Сохранить'}
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

export default AddEmployeePage;
