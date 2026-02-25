import React, {useState, useEffect, useRef, useMemo} from 'react';
import {DataTable} from 'primereact/datatable';
import {Column} from 'primereact/column';
import {InputText} from 'primereact/inputtext';
import {FilterMatchMode} from 'primereact/api';
import {OverlayPanel} from 'primereact/overlaypanel';
import {Compyuter} from '../../types/compyuters';
import axioss from '../../api/axios';
import {BASE_URL} from '../../utils/urls';
import {Link} from 'react-router-dom';
import {GrEdit} from 'react-icons/gr';
import {ModalDeleteComponent} from '../Modal/ModalDelete';
import {Calendar} from "primereact/calendar";
import {useDebounce} from 'use-debounce';
import {ProgressSpinner} from "primereact/progressspinner";
import { exportToExcel } from '../../utils/excelExport';
import { FiDownload } from 'react-icons/fi';
import { toast } from 'react-toastify';

interface IFilterField {
    value: any;
    matchMode: FilterMatchMode;
}

interface IFilters {
    [key: string]: IFilterField;

    history_date: IFilterField;
    history_user: IFilterField;
}

interface IFilterOptions {
    departments: { id: number; name: string }[];
    sections: { id: number; name: string; raw_name: string }[];
    ip_addresses: string[];
    type_compyuters: { id: number; name: string }[];
    users: string[];
}

type Props = {
    checkedComputer: Compyuter[];
    setDeleteCompForChecked: React.Dispatch<React.SetStateAction<boolean>>;
    isFiltered: boolean
    loadingFilter: boolean
};

export default function ComputerTable({
                                          checkedComputer,
                                          setDeleteCompForChecked, isFiltered, loadingFilter = false
                                      }: Props) {
    const [computers, setComputers] = useState<Compyuter[]>([]);
    const [openDeleteModal, setDeleteOpenModal] = useState(false);
    const [deleteModalData, setDeleteModalData] = useState('');
    const [deleteCompData, setDeleteCompData] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [searchText, setSearchText] = useState('');
    const [first, setFirst] = useState(0);
    const [rows, setRows] = useState(50);
    const [nextUrl, setNextUrl] = useState(null);
    const [prevUrl, setPrevUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [debouncedSearch] = useDebounce(searchText, 300);
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
    const [sectionOptions, setSectionOptions] = useState<{ id: number; name: string; raw_name: string }[]>([]);
    const [isExporting, setIsExporting] = useState(false);
    const [tabelNumberSearch, setTabelNumberSearch] = useState('');
    const [departmentSearch, setDepartmentSearch] = useState('');
    const [sectionSearch, setSectionSearch] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [positionSearch, setPositionSearch] = useState('');
    const [issuedAtSearch, setIssuedAtSearch] = useState<Date | null>(null);
    const [changeDateSearch, setChangeDateSearch] = useState<Date | null>(null);
    const [changeUserSearch, setChangeUserSearch] = useState('');
    const [historyUserOptions, setHistoryUserOptions] = useState<string[]>([]);


    const extractPrefix = (s: string | undefined): number => {
        if (!s) return Number.POSITIVE_INFINITY;
        const m = s.match(/^(\d+)/);
        return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
    };

    const [filterOptions, setFilterOptions] = useState<IFilterOptions>({
        departments: [],
        sections: [],
        ip_addresses: [],
        type_compyuters: [],
        users: [],
    });
    const dateOverlay = useRef<OverlayPanel | null>(null);
    const userOverlay = useRef<OverlayPanel | null>(null);

    useEffect(() => {
        axioss
            .get(`${BASE_URL}/filter-options/`)
            .then((response) => {
                setFilterOptions(response.data);
            })
            .catch((err) => console.error('Ошибка получения фильтров:', err));
    }, []);

    useEffect(() => {
        axioss
            .get(`${BASE_URL}/item-history-users/`)
            .then((response) => {
                const users = Array.isArray(response.data?.users)
                    ? response.data.users.map((user: unknown) => String(user).trim()).filter(Boolean)
                    : [];
                setHistoryUserOptions(users);
            })
            .catch((err) => console.error('Ошибка получения пользователей истории:', err));
    }, []);


    useEffect(() => {
        if (checkedComputer && checkedComputer.length > 0) {
            const cloned = checkedComputer.map((comp) => ({...comp}));
            setComputers(sortByDepartment(cloned));
        } else {
            setComputers([]);
        }
        setDeleteCompForChecked(deleteCompData);
    }, [checkedComputer, deleteCompData, setDeleteCompForChecked]);

    const [filters, setFilters] = useState<IFilters>({
        global: {value: '', matchMode: FilterMatchMode.CONTAINS},
        'employee.department.name': {value: null, matchMode: FilterMatchMode.CONTAINS},
        'employee.section.name': {value: null, matchMode: FilterMatchMode.CONTAINS},
        'employee.tabel_number': {value: null, matchMode: FilterMatchMode.CONTAINS},
        'type_compyuter.name': {value: null, matchMode: FilterMatchMode.CONTAINS},
        issued_at: {value: null, matchMode: FilterMatchMode.CONTAINS},
        user: {value: null, matchMode: FilterMatchMode.CONTAINS},
        history_date: {value: null, matchMode: FilterMatchMode.DATE_IS},
        history_user: {value: null, matchMode: FilterMatchMode.CONTAINS},
    });

    useEffect(() => {
        if (isFiltered) {
            const page = Math.floor(first / rows);
            if (checkedComputer && checkedComputer.length > 0) {
                setComputers(sortByDepartment(checkedComputer).slice(page * rows, (page + 1) * rows));
                setTotalCount(checkedComputer.length);
            } else {
                setComputers([]);
                setTotalCount(0);
            }
            return;
        }
        setLoading(true);
        const params = buildQueryParams(debouncedSearch);
        axioss.get(`${BASE_URL}/all-items/?${params}`)
            .then(res => {
                if (res.data.results && res.data.results.length > 0) {
                    const sorted = sortByDepartment(res.data.results);
                    setComputers(sorted);
                    setTotalCount(res.data.count);
                } else {
                    if (res.data.count > 0 && first > 0) {
                        setFirst(Math.max(0, first - rows));
                        return;
                    }
                    setComputers([]);
                    setTotalCount(0);
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [isFiltered, first, rows, debouncedSearch, filters, checkedComputer, deleteCompData]);

    const buildQueryParams = (search: string) => {
        const params = new URLSearchParams();

        if (filters['employee.department.name'].value) {
            params.append('department', filters['employee.department.name'].value);
        }

        if (filters['employee.section.name'].value) {
            params.append('section', filters['employee.section.name'].value);
        }

        if (filters['employee.tabel_number'].value) {
            params.append('tabel_number', filters['employee.tabel_number'].value);
        }

        if (filters['type_compyuter.name'].value) {
            params.append('type', filters['type_compyuter.name'].value);
        }

        if (filters['issued_at'].value) {
            params.append('issued_at', filters['issued_at'].value);
        }

        if (filters['user'].value) {
            params.append('user', filters['user'].value);
        }

        if (filters['history_date'].value) {
            const date = new Date(filters['history_date'].value).toISOString().slice(0, 10);
            params.append('history_date', date);
        }

        if (filters['history_user'].value) {
            params.append('history_user', filters['history_user'].value);
        }
        
        if (search) {
            params.append('search', search);
        }

        params.append('page', String(Math.floor(first / rows) + 1));
        params.append('page_size', String(rows));

        return params.toString();
    };


    const isActiveBodyTemplate = (rowData: Compyuter) => {
        const backendIsActiveRaw =
            (rowData as any)?.isActive ??
            (rowData as any)?.isAtive ??
            (rowData as any)?.isactive ??
            (rowData as any)?.employee?.isActive ??
            (rowData as any)?.employee?.isAtive ??
            false;

        const backendIsActive =
            typeof backendIsActiveRaw === 'string'
                ? backendIsActiveRaw.toLowerCase() === 'true'
                : Boolean(backendIsActiveRaw);

        return (
            <input
                type="checkbox"
                checked={backendIsActive}
                disabled
                className="ml-5"
            />
        );
    };

    const isDetail = (rowData: Compyuter) => {
        return (
            <div className="sm:col-span-1 col-span-3 flex items-center">
                <div className="flex items-center space-x-3.5">
                    <Link
                        to={`/item-view/${rowData.slug}`}
                        className="hover:text-primary"
                    >
                        <svg
                            className="fill-current"
                            width="18"
                            height="18"
                            viewBox="0 0 18 18"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M8.99981 14.8219C3.43106 14.8219 0.674805 9.50624 0.562305 9.28124C0.47793 9.11249 0.47793 8.88749 0.562305 8.71874C0.674805 8.49374 3.43106 3.20624 8.99981 3.20624C14.5686 3.20624 17.3248 8.49374 17.4373 8.71874C17.5217 8.88749 17.5217 9.11249 17.4373 9.28124C17.3248 9.50624 14.5686 14.8219 8.99981 14.8219ZM1.85605 8.99999C2.4748 10.0406 4.89356 13.5562 8.99981 13.5562C13.1061 13.5562 15.5248 10.0406 16.1436 8.99999C15.5248 7.95936 13.1061 4.44374 8.99981 4.44374C4.89356 4.44374 2.4748 7.95936 1.85605 8.99999Z"
                                fill=""
                            />
                            <path
                                d="M9 11.3906C7.67812 11.3906 6.60938 10.3219 6.60938 9C6.60938 7.67813 7.67812 6.60938 9 6.60938C10.3219 6.60938 11.3906 7.67813 11.3906 9C11.3906 10.3219 10.3219 11.3906 9 11.3906ZM9 7.875C8.38125 7.875 7.875 8.38125 7.875 9C7.875 9.61875 8.38125 10.125 9 10.125C9.61875 10.125 10.125 9.61875 10.125 9C10.125 8.38125 9.61875 7.875 9 7.875Z"
                                fill=""
                            />
                        </svg>
                    </Link>
                    <Link to={`/edit-employee/${rowData.slug}`}>
                        <GrEdit className="hover:text-primary"/>
                    </Link>
                    <button
                        className="hover:text-primary"
                        onClick={() => {
                            setDeleteOpenModal(true);
                            setDeleteModalData(rowData.slug);
                        }}
                    >
                        <svg
                            className="fill-current"
                            width="18"
                            height="18"
                            viewBox="0 0 18 18"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M13.7535 2.47502H11.5879V1.9969C11.5879 1.15315 10.9129 0.478149 10.0691 0.478149H7.90352C7.05977 0.478149 6.38477 1.15315 6.38477 1.9969V2.47502H4.21914C3.40352 2.47502 2.72852 3.15002 2.72852 3.96565V4.8094C2.72852 5.42815 3.09414 5.9344 3.62852 6.1594L4.07852 15.4688C4.13477 16.6219 5.09102 17.5219 6.24414 17.5219H11.7004C12.8535 17.5219 13.8098 16.6219 13.866 15.4688L14.3441 6.13127C14.8785 5.90627 15.2441 5.3719 15.2441 4.78127V3.93752C15.2441 3.15002 14.5691 2.47502 13.7535 2.47502ZM7.67852 1.9969C7.67852 1.85627 7.79102 1.74377 7.93164 1.74377H10.0973C10.2379 1.74377 10.3504 1.85627 10.3504 1.9969V2.47502H7.70664V1.9969H7.67852ZM4.02227 3.96565C4.02227 3.85315 4.10664 3.74065 4.24727 3.74065H13.7535C13.866 3.74065 13.9785 3.82502 13.9785 3.96565V4.8094C13.9785 4.9219 13.8941 5.0344 13.7535 5.0344H4.24727C4.13477 5.0344 4.02227 4.95002 4.02227 4.8094V3.96565ZM11.7285 16.2563H6.27227C5.79414 16.2563 5.40039 15.8906 5.37227 15.3844L4.95039 6.2719H13.0785L12.6566 15.3844C12.6004 15.8625 12.2066 16.2563 11.7285 16.2563Z"
                                fill=""
                            />
                            <path
                                d="M9.00039 9.11255C8.66289 9.11255 8.35352 9.3938 8.35352 9.75942V13.3313C8.35352 13.6688 8.63477 13.9782 9.00039 13.9782C9.33789 13.9782 9.64727 13.6969 9.64727 13.3313V9.75942C9.64727 9.3938 9.33789 9.11255 9.00039 9.11255Z"
                                fill=""
                            />
                            <path
                                d="M11.2502 9.67504C10.8846 9.64692 10.6033 9.90004 10.5752 10.2657L10.4064 12.7407C10.3783 13.0782 10.6314 13.3875 10.9971 13.4157C11.0252 13.4157 11.0252 13.4157 11.0533 13.4157C11.3908 13.4157 11.6721 13.1625 11.6721 12.825L11.8408 10.35C11.8408 9.98442 11.5877 9.70317 11.2502 9.67504Z"
                                fill=""
                            />
                            <path
                                d="M6.72245 9.67504C6.38495 9.70317 6.1037 10.0125 6.13182 10.35L6.3287 12.825C6.35683 13.1625 6.63808 13.4157 6.94745 13.4157C6.97558 13.4157 6.97558 13.4157 7.0037 13.4157C7.3412 13.3875 7.62245 13.0782 7.59433 12.7407L7.39745 10.2657C7.39745 9.90004 7.08808 9.64692 6.72245 9.67504Z"
                                fill=""
                            />
                        </svg>
                    </button>
                </div>
            </div>
        );
    };

    const typeComputerBodyTemplate = (rowData: Compyuter) => {
        const position = (rowData as any)?.employee?.position;
        if (!position) return '—';
        return position;
    };

    const userBodyTemplate = (rowData: Compyuter) => {
        const employee = (rowData as any)?.employee;
        if (!employee) return '—';
        return [employee.last_name, employee.first_name].filter(Boolean).join(' ');
    };

    const updatedUserLabel = (rowData: any) => {
        const updatedUser = rowData?.updatedUser;
        if (!updatedUser) return null;
        if (typeof updatedUser === 'string' || typeof updatedUser === 'number') return String(updatedUser);
        if (typeof updatedUser === 'object') {
            return updatedUser.username || updatedUser.full_name || updatedUser.name || String(updatedUser.id ?? '');
        }
        return null;
    };

    const deptOverlay = useRef<OverlayPanel | null>(null);
    const sectionOverlay = useRef<OverlayPanel | null>(null);
    const typeOverlay = useRef<OverlayPanel | null>(null);
    const ipOverlay = useRef<OverlayPanel | null>(null);

    const handleDepartmentSelect = (depName: string) => {
        const dep = filterOptions.departments.find(d => d.name === depName);
        setFilters((prev) => ({
            ...prev,
            'employee.department.name': {
                value: depName,
                matchMode: FilterMatchMode.CONTAINS,
            },
            'employee.section.name': {value: null, matchMode: FilterMatchMode.CONTAINS}, // сброс отдела
        }));
        setSelectedDepartmentId(dep ? dep.id : null);
        setFirst(0);
    };

    useEffect(() => {
        if (!selectedDepartmentId) {
            setSectionOptions([]);
            return;
        }

        axioss
            .get(`${BASE_URL}/all_texnology/`, {
                params: {departament: selectedDepartmentId},
            })
            .then((res) => {
                setSectionOptions(res.data.section);
            })
            .catch((err) => {
                console.error('Ошибка получения отделов по цеху:', err);
                setSectionOptions([]);
            });
    }, [selectedDepartmentId]);


    const handleSectionSelect = (secName: string) => {
        setFilters((prev) => ({
            ...prev,
            'employee.section.name': {
                value: secName,
                matchMode: FilterMatchMode.CONTAINS,
            },
        }));
        (sectionOverlay.current as any)?.hide();
    };

    const handleTypeSelect = (typeName: string) => {
        setFilters((prev) => ({
            ...prev,
            'type_compyuter.name': {
                value: typeName,
                matchMode: FilterMatchMode.CONTAINS,
            },
        }));
        (typeOverlay.current as any)?.hide();
    };

    const handleIpSelect = (ipValue: string) => {
        setFilters((prev) => ({
            ...prev,
            issued_at: {
                value: ipValue,
                matchMode: FilterMatchMode.CONTAINS,
            },
        }));
        (ipOverlay.current as any)?.hide();
    };

    const overlayClassName =
        'p-3 bg-white text-black rounded-md shadow-lg max-h-60 overflow-y-auto';

    const handleDateSelect = (e: any) => {
        const selectedDate = e.value instanceof Date
            ? e.value
            : new Date(e.value);

        setFilters(prev => ({
            ...prev,
            history_date: {
                value: selectedDate,
                matchMode: FilterMatchMode.DATE_IS
            }
        }));
        dateOverlay.current?.hide();
    };


    const handleUserSelect = (username: string) => {
        setFilters(prev => ({
            ...prev,
            history_user: {value: username, matchMode: FilterMatchMode.CONTAINS}
        }));
        userOverlay.current?.hide();
    };

    const handleExportToExcel = async () => {
        try {
            setIsExporting(true);
            
            // Экспортируем текущие отфильтрованные данные
            let dataToExport = isFiltered ? checkedComputer : computers;
            const filename = isFiltered ? 'filtered_computers' : 'all_computers';

            // Если мы на первой странице и не используем фильтрацию по карточкам (сверху),
            // скачиваем все данные с сервера с учетом текущих фильтров в таблице.
            if (first === 0 && !isFiltered) {
                const params = buildQueryParams(debouncedSearch);
                const response = await axioss.get(`${BASE_URL}/all-items/?${params}&no_pagination=true`);
                dataToExport = response.data;
            }
            
            if (dataToExport.length === 0) {
                toast.warning('Нет данных для экспорта');
                return;
            }
            
            exportToExcel(dataToExport, filename);
            toast.success(`Успешно экспортировано ${dataToExport.length} записей в Excel`);
        } catch (error) {
            console.error('Ошибка при экспорте:', error);
            toast.error('Произошла ошибка при экспорте данных');
        } finally {
            setIsExporting(false);
        }
    };

    const onSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFirst(0);
        const v = e.target.value
        setSearchText(v);
        // setFilters(f => ({...f, global: {value: v, matchMode: FilterMatchMode.CONTAINS}}));
    };

    const clearFilter = (field: string) => {
        setFilters((prev) => {
            const updated = {
                ...prev,
                [field]: {value: null, matchMode: FilterMatchMode.CONTAINS},
            };
            if (field === 'employee.department.name') {
                updated['employee.section.name'] = {value: null, matchMode: FilterMatchMode.CONTAINS};
                setSelectedDepartmentId(null);
                setSectionOptions([]);
            }
            return updated;
        });
    };


    const resetAllFilters = () => {
        setFilters({
            global: {value: '', matchMode: FilterMatchMode.CONTAINS},
            'employee.department.name': {value: null, matchMode: FilterMatchMode.CONTAINS},
            'employee.section.name': {value: null, matchMode: FilterMatchMode.CONTAINS},
            'employee.tabel_number': {value: null, matchMode: FilterMatchMode.CONTAINS},
            'type_compyuter.name': {value: null, matchMode: FilterMatchMode.CONTAINS},
            issued_at: {value: null, matchMode: FilterMatchMode.CONTAINS},
            user: {value: null, matchMode: FilterMatchMode.CONTAINS},
            history_date: {value: null, matchMode: FilterMatchMode.DATE_IS},
            history_user: {value: null, matchMode: FilterMatchMode.CONTAINS},
        });
        setSearchText('');
        setFirst(0);
    };

    const sortedDepartments = filterOptions.departments
        .slice()
        .sort((a, b) => {
            const n1 = extractPrefix(a.name);
            const n2 = extractPrefix(b.name);
            if (n1 === n2) {
                return a.name.localeCompare(b.name, undefined, {sensitivity: 'base'});
            }
            return n1 - n2;
        });

    const departmentHeader = (
        <div className="flex items-center justify-center">
            <span>Цехы</span>
            {filters['employee.department.name'] && filters['employee.department.name'].value && (
                <i
                    className="pi pi-times-circle ml-2 cursor-pointer text-red-500"
                    title="Очистить"
                    onClick={() => clearFilter('employee.department.name')}
                />
            )}
            <i
                className="pi pi-filter ml-2 cursor-pointer text-gray-700"
                onClick={(e) => (deptOverlay.current as any)?.toggle(e)}
            />
            <OverlayPanel
                ref={deptOverlay}
                className={overlayClassName}
                appendTo={document.body}
            >
                {sortedDepartments.length === 0 ? (
                    <div className="text-gray-500">Нет данных</div>
                ) : (
                    sortedDepartments.map((dep) => (
                        <button
                            key={dep.id}
                            className="block w-full text-left px-3 py-1 rounded hover:bg-gray-100"
                            onClick={() => handleDepartmentSelect(dep.name)}
                        >
                            {dep.name}
                        </button>
                    ))
                )}
            </OverlayPanel>
        </div>
    );

    // const sectionHeader = (
    //     <div className="flex items-center justify-center">
    //         <span>Отдел</span>
    //         {filters['section.name'] && filters['section.name'].value && (
    //             <i
    //                 className="pi pi-times-circle ml-2 cursor-pointer text-red-500"
    //                 title="Очистить"
    //                 onClick={() => clearFilter('section.name')}
    //             />
    //         )}
    //         <i
    //             className="pi pi-filter ml-2 cursor-pointer text-gray-700"
    //             onClick={(e) => (sectionOverlay.current as any)?.toggle(e)}
    //         />
    //         <OverlayPanel ref={sectionOverlay} className={overlayClassName} appendTo={document.body}>
    //             {filterOptions.sections.length === 0 ? (
    //                 <div className="text-gray-500">Нет данных</div>
    //             ) : (
    //                 filterOptions.sections.map((sec) => (
    //                     <button
    //                         key={sec.id}
    //                         className="block w-full text-left px-3 py-1 rounded hover:bg-gray-100"
    //                         onClick={() => handleSectionSelect(sec.name)}
    //                     >
    //                         {sec.name}
    //                     </button>
    //                 ))
    //             )}
    //         </OverlayPanel>
    //     </div>
    // );
    const sectionHeader = (
        <div className="flex items-center justify-center">
            <span>Отдел</span>
            {filters['employee.section.name'] && filters['employee.section.name'].value && (
                <i
                    className="pi pi-times-circle ml-2 cursor-pointer text-red-500"
                    title="Очистить"
                    onClick={() => clearFilter('employee.section.name')}
                />
            )}
            <i
                className={`pi pi-filter ml-2 cursor-pointer text-gray-700 ${!selectedDepartmentId ? 'opacity-40 cursor-not-allowed' : ''}`}
                onClick={(e) => {
                    if (selectedDepartmentId) {
                        (sectionOverlay.current as any)?.toggle(e);
                    }
                }}
                title={selectedDepartmentId ? 'Выбрать отдел' : 'Сначала выберите цех'}
            />
            <OverlayPanel ref={sectionOverlay} className={overlayClassName} appendTo={document.body}>
                {!selectedDepartmentId ? (
                    <div className="text-gray-500">Сначала выберите цех</div>
                ) : sectionOptions.length === 0 ? (
                    <div className="text-gray-500">Нет данных</div>
                ) : (
                    sectionOptions.map((sec) => (
                        <button
                            key={sec.id}
                            className="block w-full text-left px-3 py-1 rounded hover:bg-gray-100"
                                                    onClick={() => handleSectionSelect(sec.raw_name)}
                    >
                        {sec.raw_name}
                        </button>
                    ))
                )}
            </OverlayPanel>
        </div>
    );


    const typeHeader = (
        <div className="flex items-center justify-center">
            <span>Должность</span>
            {filters['type_compyuter.name'] && filters['type_compyuter.name'].value && (
                <i
                    className="pi pi-times-circle ml-2 cursor-pointer text-red-500"
                    title="Очистить"
                    onClick={() => clearFilter('type_compyuter.name')}
                />
            )}
            <i
                className="pi pi-filter ml-2 cursor-pointer text-gray-700"
                onClick={(e) => (typeOverlay.current as any)?.toggle(e)}
            />
            <OverlayPanel ref={typeOverlay} className={overlayClassName} appendTo={document.body}>
                {filterOptions.type_compyuters.length === 0 ? (
                    <div className="text-gray-500">Нет данных</div>
                ) : (
                    filterOptions.type_compyuters.map((typeC) => (
                        <button
                            key={typeC.id}
                            className="block w-full text-left px-3 py-1 rounded hover:bg-gray-100"
                            onClick={() => handleTypeSelect(typeC.name)}
                        >
                            {typeC.name}
                        </button>
                    ))
                )}
            </OverlayPanel>
        </div>
    );
    const changesHeader = (
        <div className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center">
                <span>Изменение</span>
                {changeUserSearch && (
                    <i
                        className="pi pi-times-circle ml-2 cursor-pointer text-red-500"
                        title="Сбросить пользователя"
                        onClick={() => {
                            setChangeUserSearch('');
                            setFilters(prev => ({
                                ...prev,
                                history_user: { value: null, matchMode: FilterMatchMode.CONTAINS }
                            }));
                            setFirst(0);
                        }}
                    />
                )}
                <i
                    className="pi pi-filter ml-2 cursor-pointer text-gray-700"
                    title="Выбрать пользователя"
                    onClick={e => userOverlay.current?.toggle(e)}
                />
                <OverlayPanel
                    ref={userOverlay}
                    appendTo={document.body}
                    className="bg-white p-3 rounded shadow-lg max-h-60 overflow-auto"
                >
                    {(historyUserOptions.length > 0
                        ? historyUserOptions
                        : Array.from(new Set(
                            computers
                                .map((item) => String((item as any)?.history_user ?? '').trim())
                                .filter(Boolean)
                        ))
                    )
                        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
                        .map((user) => (
                            <button
                                key={user}
                                className="block w-full text-left px-3 py-1 hover:bg-gray-100"
                                onClick={() => {
                                    setChangeUserSearch(user);
                                    setFilters(prev => ({
                                        ...prev,
                                        history_user: { value: user, matchMode: FilterMatchMode.CONTAINS }
                                    }));
                                    setFirst(0);
                                    userOverlay.current?.hide();
                                }}
                            >
                                {user}
                            </button>
                        ))}
                </OverlayPanel>
            </div>
            <Calendar
                value={changeDateSearch}
                onChange={(e) => {
                    const selectedDate = e.value ? new Date(e.value as Date) : null;
                    setChangeDateSearch(selectedDate);
                    setFilters(prev => ({
                        ...prev,
                        history_date: { value: selectedDate, matchMode: FilterMatchMode.DATE_IS }
                    }));
                    setFirst(0);
                }}
                dateFormat="dd.mm.yy"
                placeholder="Дата..."
                className="w-[140px] h-7 text-xs"
                inputClassName="text-xs"
                panelClassName="border border-gray-300 bg-white shadow-md"
            />
        </div>
    );


    const formatDateKey = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const formatDisplayDate = (value: unknown) => {
        if (!value) return '—';
        const parsed = value instanceof Date ? value : new Date(String(value));
        if (Number.isNaN(parsed.getTime())) return String(value);

        const day = String(parsed.getDate()).padStart(2, '0');
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const year = parsed.getFullYear();
        return `${day}.${month}.${year}`;
    };

    const formatDisplayDateTime = (value: unknown) => {
        if (!value) return '—';
        const parsed = value instanceof Date ? value : new Date(String(value));
        if (Number.isNaN(parsed.getTime())) return String(value);

        const day = String(parsed.getDate()).padStart(2, '0');
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const year = parsed.getFullYear();
        const hours = String(parsed.getHours()).padStart(2, '0');
        const minutes = String(parsed.getMinutes()).padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}`;
    };

    const ipHeader = (
        <div className="flex flex-col items-center gap-2">
            <span>Дата выдачи</span>
            <Calendar
                value={issuedAtSearch}
                onChange={(e) => {
                    setIssuedAtSearch(e.value ? new Date(e.value as Date) : null);
                    setFirst(0);
                }}
                dateFormat="dd.mm.yy"
                placeholder="Выберите дату"
                className="w-[140px] h-7 text-xs"
                inputClassName="text-xs"
                panelClassName="border border-gray-300 bg-white shadow-md"
            />
        </div>
    );

    const sortByDepartment = (data: Compyuter[]): Compyuter[] => {
        return [...data].sort((a, b) => {
            const aName = (a as any).employee?.department?.name;
            const bName = (b as any).employee?.department?.name;
            
            // Если у одного из компьютеров нет департамента, помещаем его в конец
            if (!aName && !bName) return 0;
            if (!aName) return 1;
            if (!bName) return -1;
            
            const n1 = extractPrefix(aName);
            const n2 = extractPrefix(bName);
            
            if (n1 === n2) {
                return aName.localeCompare(bName, undefined, {sensitivity: 'base'});
            }
            return n1 - n2;
        });
    };

    const filteredComputers = useMemo(() => {
        const departmentValue = departmentSearch.trim().toLowerCase();
        const sectionValue = sectionSearch.trim().toLowerCase();
        const tabelValue = tabelNumberSearch.trim().toLowerCase();
        const userValue = userSearch.trim().toLowerCase();
        const positionValue = positionSearch.trim().toLowerCase();
        const issuedAtValue = issuedAtSearch ? formatDateKey(issuedAtSearch) : '';
        const changeDateValue = changeDateSearch ? formatDateKey(changeDateSearch) : '';
        const changeUserValue = changeUserSearch.trim().toLowerCase();

        return computers.filter((computer) => {
            const employee = (computer as any)?.employee;
            const department = String(employee?.department?.name ?? '').toLowerCase();
            const section = String(employee?.section?.name ?? '').toLowerCase();
            const tabelNumber = String(employee?.tabel_number ?? '').toLowerCase();
            const fullName = [employee?.last_name, employee?.first_name]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            const position = String(employee?.position ?? '').toLowerCase();
            const issuedAtRaw = (computer as any)?.issued_at;
            const issuedAt = issuedAtRaw instanceof Date
                ? formatDateKey(issuedAtRaw)
                : String(issuedAtRaw ?? '').split('T')[0];
            const historyDateRaw = (computer as any)?.history_date;
            const historyDate = historyDateRaw ? formatDateKey(new Date(historyDateRaw)) : '';
            const historyUser = String((computer as any)?.history_user ?? '').toLowerCase();

            return (
                (!departmentValue || department.includes(departmentValue)) &&
                (!sectionValue || section.includes(sectionValue)) &&
                (!tabelValue || tabelNumber.includes(tabelValue)) &&
                (!userValue || fullName.includes(userValue)) &&
                (!positionValue || position.includes(positionValue)) &&
                (!issuedAtValue || issuedAt === issuedAtValue) &&
                (!changeDateValue || historyDate === changeDateValue) &&
                (!changeUserValue || historyUser.includes(changeUserValue))
            );
        });
    }, [computers, departmentSearch, sectionSearch, tabelNumberSearch, userSearch, positionSearch, issuedAtSearch, changeDateSearch, changeUserSearch]);

    const departmentInputHeader = (
        <div className="flex flex-col items-center gap-2">
            <span>Цехы</span>
            <InputText
                value={departmentSearch}
                onChange={(e) => {
                    setDepartmentSearch(e.target.value);
                    setFirst(0);
                }}
                placeholder="Поиск..."
                className="w-[140px] h-7 text-xs bg-transparent px-2 border border-gray-300 rounded-md placeholder:text-xs"
            />
        </div>
    );

    const sectionInputHeader = (
        <div className="flex flex-col items-center gap-2">
            <span>Отдел</span>
            <InputText
                value={sectionSearch}
                onChange={(e) => {
                    setSectionSearch(e.target.value);
                    setFirst(0);
                }}
                placeholder="Поиск..."
                className="w-[140px] h-7 text-xs bg-transparent px-2 border border-gray-300 rounded-md placeholder:text-xs"
            />
        </div>
    );

    const tabelNumberHeader = (
        <div className="flex flex-col items-center gap-2">
            <span>Табельный номер</span>
            <InputText
                value={tabelNumberSearch}
                onChange={(e) => {
                    setTabelNumberSearch(e.target.value);
                    setFirst(0);
                }}
                placeholder="Поиск..."
                className="w-[140px] h-7 text-xs bg-transparent px-2 border border-gray-300 rounded-md placeholder:text-xs"
            />
        </div>
    );

    const userInputHeader = (
        <div className="flex flex-col items-center gap-2">
            <span>Пользователь</span>
            <InputText
                value={userSearch}
                onChange={(e) => {
                    setUserSearch(e.target.value);
                    setFirst(0);
                }}
                placeholder="Поиск..."
                className="w-[140px] h-7 text-xs bg-transparent px-2 border border-gray-300 rounded-md placeholder:text-xs"
            />
        </div>
    );

    const positionInputHeader = (
        <div className="flex flex-col items-center gap-2">
            <span>Должность</span>
            <InputText
                value={positionSearch}
                onChange={(e) => {
                    setPositionSearch(e.target.value);
                    setFirst(0);
                }}
                placeholder="Поиск..."
                className="w-[140px] h-7 text-xs bg-transparent px-2 border border-gray-300 rounded-md placeholder:text-xs"
            />
        </div>
    );

    return (
        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="sm:flex justify-between py-6 px-4 md:px-6 xl:px-7.5 border-b">
                <h4 className="text-xl font-semibold text-black dark:text-white">
                    Соотрудники
                </h4>
                <div className="flex items-center gap-3">
                    {/* Кнопка скачать Excel */}
                    <button
                        onClick={handleExportToExcel}
                        disabled={isExporting}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors duration-200 ${
                            isExporting 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-green-600 hover:bg-green-700'
                        } text-white`}
                        title="Скачать данные в Excel"
                    >
                        {isExporting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Экспорт...
                            </>
                        ) : (
                            <>
                                <FiDownload className="w-4 h-4" />
                                Скачать Excel
                            </>
                        )}
                    </button>

                    {/* Глобальный поиск */}
                    <InputText
                        type="search"
                        value={searchText}
                        onChange={onSearch}
                        placeholder="Поиск..."
                    />

                </div>
            </div>

            {loadingFilter && (
                <div className="flex justify-center items-center py-8">
                    <ProgressSpinner
                        style={{width: '50px', height: '50px'}}
                        strokeWidth="4"
                    />
                    <span className="ml-3 text-gray-600">Загрузка данных...</span>
                </div>
            )}


            {!loadingFilter && (
                <DataTable
                    value={filteredComputers}
                    paginator
                    lazy
                    first={first}
                    rows={rows}
                    onPage={e => {
                        setFirst(e.first);
                        setRows(e.rows);
                    }}
                    totalRecords={(departmentSearch.trim() || sectionSearch.trim() || tabelNumberSearch.trim() || userSearch.trim() || positionSearch.trim() || issuedAtSearch || changeDateSearch || changeUserSearch.trim()) ? filteredComputers.length : totalCount}
                    filters={filters}
                    emptyMessage={
                        <div
                            style={{
                                textAlign: 'center',
                                padding: '20px',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                color: 'gray',
                            }}
                        >
                            🚫 Данные не найдены
                        </div>
                    }
                    globalFilterFields={[
                        'employee.department.name',
                        'employee.section.name',
                        'employee.tabel_number',
                        'employee.first_name',
                        'employee.last_name',
                        'employee.surname',
                        'employee.position',
                        'issued_at',
                        'next_due_date',
                        'isActive',
                        'slug',
                        'issued_by_info.username',
                        'issued_by_info.full_name',
                        'addedUser',
                        'updatedUser',
                        'updatedAt',
                        'history_date',
                        'history_user'
                    ]}
                    rowClassName={() => 'border border-gray-300'}
                    className="p-3 table-border"
                    style={{fontSize: '90%'}}
                >
                <Column
                    header="№"
                    body={(_, options) => {
                        const globalIndex = first + options.rowIndex + 1;
                        return <span>{globalIndex}</span>;
                    }}
                    bodyStyle={{border: '1px solid #c8c5c4',}}
                    style={{width: '40px', textAlign: 'center'}}
                    headerStyle={{
                        fontWeight: 'bold',
                        textAlign: 'center',
                        paddingLeft: '15px',
                        color: 'black',
                        border: '1px solid #c8c5c4',
                    }}
                />

                <Column
                    field="employee.department.name"
                    header={departmentInputHeader}
                    bodyStyle={{
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        width: "300px",
                        padding: "10px",
                        paddingLeft: "15px",
                    }}
                    headerStyle={{
                        fontWeight: 'bold',
                        border: '1px solid #c8c5c4',
                        textAlign: 'center',
                        padding: '10px',
                        color: 'black',
                    }}
              

                />
                <Column
                    field="employee.section.name"
                    header={sectionInputHeader}
                    headerStyle={{
                        fontWeight: 'bold',
                        border: '1px solid #c8c5c4',
                        textAlign: 'center',
                        padding: '10px',
                        color: 'black',
                    }}
                />
                <Column
                    field="employee.tabel_number"
                    header={tabelNumberHeader}
                    headerStyle={{
                        fontWeight: 'bold',
                        border: '1px solid #c8c5c4',
                        textAlign: 'center',
                        padding: '10px',
                        color: 'black',
                    }}
                />
                <Column
                    field="employee.first_name"
                    header={userInputHeader}
                    body={userBodyTemplate}
                    headerStyle={{
                        fontWeight: 'bold',
                        border: '1px solid #c8c5c4',
                        textAlign: 'center',
                        padding: '10px',
                        color: 'black',
                    }}
                />
                <Column
                    field="employee.position"
                    body={typeComputerBodyTemplate}
                    header={positionInputHeader}
                    headerStyle={{
                        fontWeight: 'bold',
                        border: '1px solid #c8c5c4',
                        textAlign: 'center',
                        padding: '10px',
                        color: 'black',
                    }}
                />
                <Column
                    field="issued_at"
                    header={ipHeader}
                    body={(rowData) => formatDisplayDate((rowData as any)?.issued_at)}
                    headerStyle={{
                        fontWeight: 'bold',
                        border: '1px solid #c8c5c4',
                        textAlign: 'center',
                        padding: '10px',
                        color: 'black',
                    }}
                />

                <Column
                    field="changes"
                    header={changesHeader}
                    body={(rowData) => (
                        <div style={{textAlign: 'center', fontSize: '0.8rem', lineHeight: 1.2}}>
                            {(rowData as any)?.history_date
                                ? <div>{formatDisplayDateTime((rowData as any).history_date)}</div>
                                : <div style={{color: '#bbb'}}>—</div>
                            }
                            {(rowData as any)?.history_user
                                ? <div>{(rowData as any).history_user}</div>
                                : null
                            }
                        </div>
                    )}

                    headerStyle={{
                        fontWeight: 'bold',
                        textAlign: 'center',
                        padding: '10px',
                        color: 'black',
                        border: '1px solid #c8c5c4',
                    }}
                />


                <Column
                    field="employee.isActive"
                    header="Активен"
                    body={isActiveBodyTemplate}
                    headerStyle={{
                        fontWeight: 'bold',
                        textAlign: 'center',
                        padding: '10px',
                        color: 'black',
                        border: '1px solid #c8c5c4',
                    }}
                />
                <Column
                    field="actions"
                    header="Действия"
                    body={isDetail}
                    headerStyle={{
                        fontWeight: 'bold',
                        textAlign: 'center',
                        padding: '10px',
                        color: 'black',
                        border: '1px solid #c8c5c4',
                    }}
                />
                </DataTable>
            )}


            <ModalDeleteComponent
                openDeleteModal={openDeleteModal}
                setDeleteOpenModal={setDeleteOpenModal}
                deleteModalData={deleteModalData}
                setDeleteCompData={setDeleteCompData}
            />
        </div>
    );
}
