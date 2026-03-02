import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axioss from '../../api/axios';
import { BASE_URL } from '../../utils/urls';
import { toast } from 'react-toastify';

type ProductInfo = {
  id: number;
  name: string;
  type_product_display?: string | null;
  size?: string;
};

type EmployeeInfo = {
  id: number;
  slug: string;
  first_name: string;
  last_name: string;
  surname: string;
  full_name: string;
  tabel_number: string;
  position?: string | null;
  base_image?: string | null;
};

type PendingIssueData = {
  id: number;
  status: string;
  expires_at: string;
  time_remaining_seconds: number;
  employee: EmployeeInfo;
  products: ProductInfo[];
  created_at: string;
};

const SignaturePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [pendingData, setPendingData] = useState<PendingIssueData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signaturePoints, setSignaturePoints] = useState<{ x: number; y: number }[]>([]);
  const [validationError, setValidationError] = useState('');

  // Fetch pending issue data
  useEffect(() => {
    if (!id) {
      setError('ID не найден');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axioss.get(`${BASE_URL}/pending-issue/${id}/`);
        setPendingData(response.data);
        setTimeRemaining(response.data.time_remaining_seconds || 0);
        setError('');
      } catch (err: any) {
        const errorData = err?.response?.data;
        if (errorData?.expired) {
          setExpired(true);
          setError('Время истекло. Начните процесс выдачи заново.');
        } else if (errorData?.confirmed) {
          toast.success('Выдача уже подтверждена');
          navigate(errorData.item_slug ? `/item-view/${errorData.item_slug}` : '/');
        } else {
          setError(errorData?.error || 'Ошибка при загрузке данных');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          setExpired(true);
          setError('Время истекло. Начните процесс выдачи заново.');
          clearInterval(timer);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Set drawing style
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [pendingData]);

  // Get position from event (supports both mouse and touch)
  const getPosition = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setValidationError('');
    const pos = getPosition(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setSignaturePoints((prev) => [...prev, pos]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const pos = getPosition(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSignature(true);
    // Sample every 3rd point to avoid too many points
    setSignaturePoints((prev) => {
      if (prev.length % 3 === 0) {
        return [...prev, pos];
      }
      return prev;
    });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setSignaturePoints([]);
    setValidationError('');
  };

  const getSignatureDataUrl = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  };

  // Validate signature to ensure it's not empty or just a simple line
  const validateSignature = (): { valid: boolean; error?: string } => {
    if (!hasSignature || signaturePoints.length < 10) {
      return { valid: false, error: 'Подпись слишком короткая' };
    }

    const points = signaturePoints;
    
    // Calculate bounding box
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX;
    const height = maxY - minY;

    // Check if signature is too small
    if (width < 30 && height < 30) {
      return { valid: false, error: 'Подпись слишком маленькая' };
    }

    // Check for straight horizontal line (very small height variance)
    if (height < 15 && width > 50) {
      return { valid: false, error: 'Простая горизонтальная линия не является подписью' };
    }

    // Check for straight vertical line (very small width variance)
    if (width < 15 && height > 50) {
      return { valid: false, error: 'Простая вертикальная линия не является подписью' };
    }

    // Calculate variance to detect straight diagonal lines
    // A real signature should have significant variance from a straight line
    if (points.length >= 5) {
      const firstPoint = points[0];
      const lastPoint = points[points.length - 1];
      
      // Calculate expected y for each x if it were a straight line
      const dx = lastPoint.x - firstPoint.x;
      const dy = lastPoint.y - firstPoint.y;
      
      if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
        // Calculate perpendicular distance from line for each point
        const lineLength = Math.sqrt(dx * dx + dy * dy);
        let totalDeviation = 0;
        
        points.forEach((point) => {
          // Distance from point to line
          const dist = Math.abs(
            dy * point.x - dx * point.y + lastPoint.x * firstPoint.y - lastPoint.y * firstPoint.x
          ) / lineLength;
          totalDeviation += dist;
        });
        
        const avgDeviation = totalDeviation / points.length;
        
        // If average deviation is very low, it's likely a straight line
        if (avgDeviation < 8) {
          return { valid: false, error: 'Простая прямая линия не является подписью' };
        }
      }
    }

    return { valid: true };
  };

  const handleSubmit = async () => {
    if (!id || !hasSignature) {
      toast.error('Подпись обязательна');
      return;
    }

    // Validate signature
    const validation = validateSignature();
    if (!validation.valid) {
      setValidationError(validation.error || 'Недействительная подпись');
      toast.error(validation.error || 'Недействительная подпись');
      return;
    }

    const signatureData = getSignatureDataUrl();
    if (!signatureData) {
      toast.error('Не удалось получить подпись');
      return;
    }

    try {
      setSubmitting(true);
      const response = await axioss.post(`${BASE_URL}/pending-issue/${id}/confirm/`, {
        signature: signatureData,
      });

      toast.success('Выдача подтверждена');
      
      const itemSlug = response.data?.item_slug;
      if (itemSlug) {
        navigate(`/item-view/${itemSlug}`);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      const errorData = err?.response?.data;
      if (errorData?.expired) {
        setExpired(true);
        setError('Время истекло. Начните процесс выдачи заново.');
      } else {
        toast.error(errorData?.error || 'Ошибка при подтверждении');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-lg">Загрузка...</div>
      </div>
    );
  }

  if (expired || error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg text-center">
          <div className="mb-4 text-6xl">⏰</div>
          <h2 className="mb-2 text-xl font-semibold text-red-600">
            {expired ? 'Время истекло' : 'Ошибка'}
          </h2>
          <p className="mb-6 text-gray-600">{error}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
          >
            Назад
          </button>
        </div>
      </div>
    );
  }

  if (!pendingData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-lg text-red-600">Данные не найдены</div>
      </div>
    );
  }

  const timeClass = timeRemaining <= 30 ? 'text-red-600 animate-pulse' : timeRemaining <= 60 ? 'text-amber-600' : 'text-green-600';

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto max-w-2xl">
        {/* Timer */}
        <div className="mb-4 rounded-lg bg-white p-4 shadow text-center">
          <div className="text-sm text-gray-500 mb-1">Оставшееся время</div>
          <div className={`text-4xl font-bold ${timeClass}`}>
            {formatTime(timeRemaining)}
          </div>
        </div>

        {/* Employee info */}
        <div className="mb-4 rounded-lg bg-white p-4 shadow">
          <h2 className="mb-3 text-lg font-semibold border-b pb-2">Сотрудник</h2>
          <div className="flex gap-4">
            {/* Base image */}
            <div className="flex-shrink-0">
              {pendingData.employee.base_image ? (
                <img
                  src={pendingData.employee.base_image}
                  alt="Фото сотрудника"
                  className="h-32 w-24 rounded border object-cover"
                />
              ) : (
                <div className="flex h-32 w-24 items-center justify-center rounded border bg-slate-100 text-xs text-gray-400">
                  Нет фото
                </div>
              )}
            </div>
            {/* Employee details */}
            <div className="flex-1">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-500">Фамилия:</div>
                <div className="font-medium">{pendingData.employee.last_name}</div>
                <div className="text-gray-500">Имя:</div>
                <div className="font-medium">{pendingData.employee.first_name}</div>
                <div className="text-gray-500">Отчество:</div>
                <div className="font-medium">{pendingData.employee.surname}</div>
                <div className="text-gray-500">Табельный №:</div>
                <div className="font-medium">{pendingData.employee.tabel_number}</div>
                {pendingData.employee.position && (
                  <>
                    <div className="text-gray-500">Должность:</div>
                    <div className="font-medium">{pendingData.employee.position}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Products list */}
        <div className="mb-4 rounded-lg bg-white p-4 shadow">
          <h2 className="mb-3 text-lg font-semibold border-b pb-2">Средства защиты</h2>
          <div className="space-y-2">
            {pendingData.products.map((product, index) => (
              <div
                key={product.id}
                className="flex items-center justify-between rounded border p-2"
              >
                <div>
                  <span className="text-gray-500 mr-2">{index + 1}.</span>
                  <span className="font-medium">{product.name}</span>
                  {product.type_product_display && (
                    <span className="ml-2 text-sm text-gray-500">
                      ({product.type_product_display})
                    </span>
                  )}
                </div>
                {product.size && (
                  <div className="rounded bg-slate-100 px-2 py-1 text-sm">
                    Размер: {product.size}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Signature area */}
        <div className="mb-4 rounded-lg bg-white p-4 shadow">
          <h2 className="mb-3 text-lg font-semibold border-b pb-2">Подпись сотрудника</h2>
          <p className="mb-3 text-sm text-gray-600">
            Нарисуйте свою подпись в области ниже
          </p>
          
          <div className="relative mb-3 rounded border-2 border-dashed border-slate-300 bg-slate-50">
            <canvas
              ref={canvasRef}
              className="w-full touch-none"
              style={{ height: '200px' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            {!hasSignature && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-gray-400">
                Подпишите здесь
              </div>
            )}
          </div>

          {validationError && (
            <div className="mb-3 rounded bg-red-50 border border-red-200 p-2 text-sm text-red-600">
              ⚠️ {validationError}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={clearSignature}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Очистить
            </button>
          </div>
        </div>

        {/* Submit button */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 rounded bg-slate-500 py-3 text-white hover:bg-slate-600"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!hasSignature || submitting}
            className="flex-1 rounded bg-green-600 py-3 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? 'Отправка...' : 'Подтвердить получение'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignaturePage;
