import { useEffect, useMemo, useRef, useState } from 'react';
import Breadcrumb from '../../components/Breadcrumbs/Breadcrumb';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Tabs } from 'flowbite-react';
import { FaLongArrowAltLeft } from 'react-icons/fa';
import { IoIosSave } from 'react-icons/io';
import { toast } from 'react-toastify';
import { Calendar } from 'primereact/calendar';
import axioss from '../../api/axios';
import { BASE_IMAGE_URL, BASE_URL } from '../../utils/urls';
import { isAuthenticated } from '../../utils/auth';
import { ModalDataInput } from '../../components/Input/ModalDataInput';
import ViewPO from '../ViewCompyuter/ViewPO';
import { getStoredFeatureAccess, normalizeRole } from '../../utils/pageAccess';

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
    base_image?: string | null;
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

type FaceBox = { x: number; y: number; width: number; height: number };

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

const resolveImageUrl = (value?: string | null) => {
  if (!value) return '';
  if (String(value).startsWith('http://') || String(value).startsWith('https://')) {
    return String(value);
  }
  return `${BASE_IMAGE_URL}${value}`;
};

const EditEmployeePage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const role = normalizeRole(localStorage.getItem('role'));
  const featureAccess = getStoredFeatureAccess(role);
  const canEditEmployee = featureAccess.dashboard_edit_employee;
  const canViewEmployeePPETab = featureAccess.employee_ppe_tab;

  const [itemDetail, setItemDetail] = useState<ItemDetail | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [baseImageFile, setBaseImageFile] = useState<File | null>(null);
  const [baseImagePreview, setBaseImagePreview] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLive, setCameraLive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceDetectorRef = useRef<any>(null);
  const detectFaceIntervalRef = useRef<number | null>(null);
  const detectInProgressRef = useRef(false);
  const [faceBoxes, setFaceBoxes] = useState<FaceBox[]>([]);
  const [faceDetectAvailable, setFaceDetectAvailable] = useState(false);
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
        setBaseImagePreview(resolveImageUrl(payload.employee?.base_image));
        setBaseImageFile(null);
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

  useEffect(() => {
    const FaceDetectorClass = (window as any)?.FaceDetector;
    if (!FaceDetectorClass) {
      setFaceDetectAvailable(false);
      return;
    }

    try {
      faceDetectorRef.current = new FaceDetectorClass({ fastMode: true, maxDetectedFaces: 5 });
      setFaceDetectAvailable(true);
    } catch {
      faceDetectorRef.current = null;
      setFaceDetectAvailable(false);
    }
  }, []);

  const clearFaceOverlay = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const drawFaceOverlay = (boxes: FaceBox[]) => {
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    if (!video || !canvas) return;

    const width = video.clientWidth || 0;
    const height = video.clientHeight || 0;
    if (width < 2 || height < 2) {
      clearFaceOverlay();
      return;
    }

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);

    const sourceWidth = video.videoWidth || width;
    const sourceHeight = video.videoHeight || height;
    const scaleX = width / sourceWidth;
    const scaleY = height / sourceHeight;

    context.strokeStyle = '#22c55e';
    context.lineWidth = 2;

    boxes.forEach((box) => {
      context.strokeRect(
        box.x * scaleX,
        box.y * scaleY,
        box.width * scaleX,
        box.height * scaleY,
      );
    });
  };

  const detectFacesViaBackend = async (): Promise<FaceBox[]> => {
    if (!videoRef.current || !canvasRef.current) return [];

    const video = videoRef.current;
    const sourceWidth = video.videoWidth || 0;
    const sourceHeight = video.videoHeight || 0;
    if (sourceWidth < 2 || sourceHeight < 2) return [];

    const maxWidth = 640;
    const targetWidth = Math.min(sourceWidth, maxWidth);
    const targetHeight = Math.max(1, Math.round((sourceHeight * targetWidth) / sourceWidth));

    const canvas = canvasRef.current;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) return [];

    context.drawImage(video, 0, 0, targetWidth, targetHeight);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.65);

    const response = await axioss.post(`${BASE_URL}/detect-face-boxes/`, {
      captured_image: imageDataUrl,
    });

    const ratioX = sourceWidth / targetWidth;
    const ratioY = sourceHeight / targetHeight;

    const boxes = (response.data?.boxes || [])
      .map((box: any) => ({
        x: Number(box?.x || 0) * ratioX,
        y: Number(box?.y || 0) * ratioY,
        width: Number(box?.width || 0) * ratioX,
        height: Number(box?.height || 0) * ratioY,
      }))
      .filter((box: FaceBox) => box.width > 0 && box.height > 0);

    return boxes;
  };

  useEffect(() => {
    if (!cameraOpen || !cameraLive || !faceDetectorRef.current || !videoRef.current) {
      if (detectFaceIntervalRef.current) {
        window.clearInterval(detectFaceIntervalRef.current);
        detectFaceIntervalRef.current = null;
      }
      setFaceBoxes([]);
      clearFaceOverlay();
      return;
    }

    const detectFaces = async () => {
      if (detectInProgressRef.current || !videoRef.current || !faceDetectorRef.current) return;
      const video = videoRef.current;
      if ((video.videoWidth || 0) < 2 || (video.videoHeight || 0) < 2) return;

      detectInProgressRef.current = true;
      try {
        let boxes: FaceBox[] = [];

        if (faceDetectorRef.current) {
          const faces = await faceDetectorRef.current.detect(video);
          boxes = (faces || [])
            .map((face: any) => {
              const bb = face?.boundingBox;
              if (!bb) return null;
              return {
                x: Number(bb.x || 0),
                y: Number(bb.y || 0),
                width: Number(bb.width || 0),
                height: Number(bb.height || 0),
              };
            })
            .filter((box: FaceBox | null): box is FaceBox => !!box && box.width > 0 && box.height > 0);
        } else {
          boxes = await detectFacesViaBackend();
        }

        setFaceBoxes(boxes);
        drawFaceOverlay(boxes);
      } catch {
        setFaceBoxes([]);
        clearFaceOverlay();
      } finally {
        detectInProgressRef.current = false;
      }
    };

    detectFaces();
  detectFaceIntervalRef.current = window.setInterval(detectFaces, faceDetectorRef.current ? 220 : 480);

    return () => {
      if (detectFaceIntervalRef.current) {
        window.clearInterval(detectFaceIntervalRef.current);
        detectFaceIntervalRef.current = null;
      }
      detectInProgressRef.current = false;
      setFaceBoxes([]);
      clearFaceOverlay();
    };
  }, [cameraOpen, cameraLive]);

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
    if (!hasLiveTrack) {
      return false;
    }

    const started = await new Promise<boolean>((resolve) => {
      let settled = false;

      const finalize = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const timeout = window.setTimeout(() => {
        finalize((video.videoWidth || 0) > 0 && (video.videoHeight || 0) > 0);
      }, 2000);

      const onCanPlay = () => {
        window.clearTimeout(timeout);
        finalize((video.videoWidth || 0) > 0 && (video.videoHeight || 0) > 0);
      };

      video.addEventListener('canplay', onCanPlay, { once: true });
    });

    return started || hasLiveTrack;
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

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    let started = await attachAndPlayStream(stream);

    if (!started) {
      stream.getTracks().forEach((track) => track.stop());
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      await attachAndPlayStream(stream);
    }

    return stream;
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
      streamRef.current = stream;

      setCameraLive(stream.getVideoTracks().some((track) => track.readyState === 'live'));
    } catch (error: any) {
      const errorName = String(error?.name || '');
      const errorMessage = String(error?.message || '');
      if (errorName === 'NotReadableError') {
        setCameraError('Kamera band (boshqa dastur ishlatyapti). Uni yopib qayta urinib ko‘ring');
      } else if (errorName === 'NotAllowedError') {
        setCameraError('Kameraga ruxsat berilmagan. Browser ruxsatini tekshiring');
      } else if (errorName === 'NotFoundError') {
        setCameraError('Kamera qurilmasi topilmadi');
      } else if (errorName || errorMessage) {
        setCameraError(`Kamera ochilmadi: ${errorName || 'Error'} ${errorMessage}`.trim());
      } else {
        setCameraError('Kamera ochilmadi. Qurilma yoki browser sozlamalarini tekshiring');
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
      streamRef.current = stream;
      setCameraLive(stream.getVideoTracks().some((track) => track.readyState === 'live'));
    } catch {
      setCameraError('Tanlangan kamera ishga tushmadi');
      setCameraOpen(false);
      setCameraLive(false);
    }
  };

  const capturePhotoFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
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
      toast.success('Фото с камеры выбрано');
    }, 'image/jpeg', 0.92);
  };

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

      let response;
      if (baseImageFile) {
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (value === null || value === undefined) {
            formData.append(key, '');
            return;
          }
          formData.append(key, String(value));
        });
        formData.append('base_image', baseImageFile);

        response = await axioss.patch(`${BASE_URL}/item-edit-personal/${slug}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        response = await axioss.patch(`${BASE_URL}/item-edit-personal/${slug}`, payload);
      }

      const responseData = response.data as ItemDetail;
      setItemDetail(responseData);
      setBaseImagePreview(resolveImageUrl(responseData.employee?.base_image));
      setBaseImageFile(null);
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

  if (!canEditEmployee) {
    return <Navigate to="/" replace />;
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
                                    <div className="relative w-full">
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
                                      <canvas ref={overlayCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                                    </div>
                                    {faceDetectAvailable && (
                                      <div className="text-xs text-gray-500">Yuz aniqlandi: {faceBoxes.length}</div>
                                    )}
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
                                <canvas ref={canvasRef} className="hidden" />
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
                        </div>
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
                {canViewEmployeePPETab && (
                  <Tabs.Item title="Средства защиты">
                    <ViewPO />
                  </Tabs.Item>
                )}
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
