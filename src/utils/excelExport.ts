import { Compyuter } from '../types/compyuters';
import * as XLSX from 'xlsx';

export const exportToExcel = (data: Compyuter[], filename: string = 'computers') => {
  // Проверяем, что данные существуют и не пустые
  if (!data || data.length === 0) {
    throw new Error('Нет данных для экспорта');
  }

  // Создаем заголовки для Excel
  const headers = [
    '№',
    'Цехы',
    'Отдел',
    'Пользователь',
    'Тип орг.техники',
    'IP адрес',
    'MAC адрес',
    'Номер пломбы',
    'Зав. склада',
    'Материнская плата',
    'Модель МП',
    'Процессор',
    'Поколение',
    'Частота',
    'HDD',
    'SSD',
    'Тип диска',
    'Тип RAM',
    'Размер RAM',
    'Видеокарта',
    'Операционная система',
    'Интернет',
    'Активен',
    'Дата добавления',
    'Дата изменения',
    'Пользователь изменения',
    'Принтеры',
    'Сканеры',
    'МФУ',
    'Веб-камеры',
    'Модели веб-камер',
    'Типы мониторов'
  ];

  // Подготавливаем данные для экспорта
  const excelRows = data.map((item, index) => [
    index + 1,
    item.departament?.name || '',
    item.section?.name || '',
    item.user || '',
    item.type_compyuter?.name || '',
    item.ipadresss || '',
    item.mac_adress || '',
    item.seal_number || '',
    item.warehouse_manager?.name || '',
    item.motherboard?.name || '',
    item.motherboard_model?.name || '',
    item.CPU?.name || '',
    item.generation?.name || '',
    item.frequency?.name || '',
    item.HDD?.name || '',
    item.SSD?.name || '',
    item.disk_type?.name || '',
    item.RAM_type?.name || '',
    item.RAMSize?.name || '',
    item.GPU?.name || '',
    item.OS || '',
    item.internet ? 'Да' : 'Нет',
    item.isActive ? 'Да' : 'Нет',
    item.joinDate ? new Date(item.joinDate).toLocaleDateString('ru-RU') : '',
    item.history_date ? new Date(item.history_date).toLocaleString('ru-RU') : '',
    item.history_user || '',
    item.printer?.map(p => p.name).join(', ') || '',
    item.scaner?.map(s => s.name).join(', ') || '',
    item.mfo?.map(m => m.name).join(', ') || '',
    item.type_webcamera?.map(w => w.name).join(', ') || '',
    item.model_webcam?.map(m => m.name).join(', ') || '',
    item.type_monitor?.map(t => t.name).join(', ') || ''
  ]);

  try {
    // 1. Создаем рабочий лист
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...excelRows]);

    // 2. Настраиваем ширину столбцов (в символах)
    worksheet['!cols'] = [
      { wch: 5 },  // №
      { wch: 15 }, // Цехы
      { wch: 25 }, // Отдел
      { wch: 25 }, // Пользователь
      { wch: 15 }, // Тип орг.техники
      { wch: 15 }, // IP адрес
      { wch: 18 }, // MAC адрес
      { wch: 15 }, // Номер пломбы
      { wch: 20 }, // Зав. склада
      { wch: 20 }, // Материнская плата
      { wch: 20 }, // Модель МП
      { wch: 20 }, // Процессор
      { wch: 12 }, // Поколение
      { wch: 12 }, // Частота
      { wch: 10 }, // HDD
      { wch: 10 }, // SSD
      { wch: 12 }, // Тип диска
      { wch: 12 }, // Тип RAM
      { wch: 12 }, // Размер RAM
      { wch: 20 }, // Видеокарта
      { wch: 25 }, // Операционная система
      { wch: 10 }, // Интернет
      { wch: 10 }, // Активен
      { wch: 15 }, // Дата добавления
      { wch: 20 }, // Дата изменения
      { wch: 20 }, // Пользователь изменения
      { wch: 20 }, // Принтеры
      { wch: 20 }, // Сканеры
      { wch: 20 }, // МФУ
      { wch: 20 }, // Веб-камеры
      { wch: 20 }, // Модели веб-камер
      { wch: 20 }  // Типы мониторов
    ];

    // 3. Создаем книгу и добавляем в нее лист
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Computers');

    // 4. Генерируем файл и скачиваем его
    // XLSX.writeFile автоматически инициирует скачивание в браузере
    const fullFilename = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fullFilename);

  } catch (error) {
    console.error('Ошибка при создании Excel файла:', error);
    throw new Error('Не удалось создать файл для экспорта');
  }
};
