import React, { useEffect, useState } from 'react';
import CardDataStats from '../../components/CardDataStats';
import { BASE_URL } from '../../utils/urls';
import { Compyuter, InfoComputerData } from '../../types/compyuters';
import axioss from '../../api/axios';
import { isAuthenticated } from '../../utils/auth';
import { Navigate } from 'react-router-dom';
import ComputerTable from '../../components/Tables/DataTable';
import Skeleton from '../../components/Skeleton/Skeleton';

const PPEHelmetGogglesIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        viewBox="0 0 64 64"
        aria-hidden="true"
        className={className}
        fill="currentColor"
    >
        <path d="M32 8c-11.6 0-21 9.4-21 21v3h42v-3c0-11.6-9.4-21-21-21zm-8 4h16v16H24V12z" />
        <rect x="8" y="33" width="48" height="8" rx="4" />
        <rect x="14" y="44" width="6" height="8" />
        <rect x="44" y="44" width="6" height="8" />
        <rect x="20" y="41" width="24" height="17" rx="8" />
        <rect x="24" y="45" width="16" height="9" rx="4" fill="white" />
    </svg>
);

const Main: React.FC = () => {
    const [computerData, setComputerData] = useState<Compyuter[]>([])
    const [selectKey, setSelectKey] = useState<string | null>("")
    const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
    const [dueMonths, setDueMonths] = useState<number>(1)

    const formatMonthWord = (count: number) => {
        const mod10 = count % 10;
        const mod100 = count % 100;
        if (mod10 === 1 && mod100 !== 11) return 'месяц';
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'месяца';
        return 'месяцев';
    };

    const handleSelectKey = (key: string | null) => {
        setSelectKey(key);
        if (!key || key === 'Все сотрудники') {
            setSelectedProductId(null);
            if (!key) {
                setIsCardFilterLoading(false);
                setLoadingFilter(false);
            }
            return;
        }

        if (String(key).startsWith('ppe:')) {
            const parsed = Number(String(key).split(':')[1]);
            setSelectedProductId(Number.isFinite(parsed) ? parsed : null);
        }

        if (!key) {
            setIsCardFilterLoading(false);
            setLoadingFilter(false);
        }
    };
    const [deleteCompForChecked, setDeleteCompForChecked] = useState<boolean>(false)
    const [infoCompData, setInfoCompData] = useState<InfoComputerData | null>()
    const token = localStorage.getItem('token')
    const [loadingFilter, setLoadingFilter] = useState(false);
    const [isCardFilterLoading, setIsCardFilterLoading] = useState(false);


    useEffect(() => {
        if (!token) return

        axioss
            .get(`${BASE_URL}/info-employee/`, {
                params: {
                    ppe_product_name: 'Спецодежда',
                    due_days: dueMonths * 30,
                },
            })
            .then((response) => {
                setInfoCompData(response.data);
            })
            .catch((err) => console.log(err));
    }, [token, dueMonths]);


    useEffect(() => {
        if (!selectKey) return;

        setIsCardFilterLoading(true);
        setLoadingFilter(true);

        const delay = new Promise<void>(resolve => setTimeout(resolve, 200));

        const payload: Record<string, string | number> = { key: selectKey };
        if (selectKey && selectKey !== 'Все сотрудники') {
            payload.due_days = dueMonths * 30;
            if (selectedProductId) {
                payload.ppe_product_id = selectedProductId;
            }
        }

        const fetchData = axioss.post(`${BASE_URL}/filter-data/`, payload);

        Promise.all([fetchData, delay])
            .then(([response]) => {
                setComputerData([...response.data]);
            })
            .catch(err => console.error(err))
            .finally(() => {
                setLoadingFilter(false);
                setIsCardFilterLoading(false);
            });
    }, [selectKey, selectedProductId, deleteCompForChecked, dueMonths]);


    if (!isAuthenticated()) {
        return <Navigate to="/auth/signin" />
    }

    return (
        <>
            {infoCompData ?
                <>
                    <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="text-base font-medium text-black dark:text-white text-[20px]">
                            До истечения срока осталось {dueMonths} {formatMonthWord(dueMonths)}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-600 dark:text-slate-300">Период:</span>
                            <select
                                value={dueMonths}
                                onChange={(event) => {
                                    setDueMonths(Number(event.target.value));
                                    handleSelectKey(null);
                                }}
                                className="rounded border border-stroke bg-white px-3 py-1.5 text-sm dark:border-strokedark dark:bg-boxdark"
                            >
                                <option value={1}>1 месяц</option>
                                <option value={2}>2 месяца</option>
                                <option value={3}>3 месяца</option>
                                <option value={6}>6 месяцев</option>
                                <option value={12}>12 месяцев</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-5 2xl:gap-7.5">
                        {(infoCompData?.due_products || []).map((product) => {
                            const cardKey = `ppe:${product.id}`;
                            const count = product.due_count ?? 0;

                            return (
                                <CardDataStats
                                    key={cardKey}
                                    title={product.name}
                                    total={`${count}`}
                                    clickKey={cardKey}
                                    setSelectKey={handleSelectKey}
                                    isLoading={isCardFilterLoading && selectKey === cardKey}
                                    isActive={selectKey === cardKey}
                                >
                                    <PPEHelmetGogglesIcon className="h-7 w-7 text-primary dark:text-white" />
                                </CardDataStats>
                            );
                        })}

                        {/* <CardDataStats title="Не рабочие компьютеры"
                            total={`${infoCompData?.all_noworked_compyuters_count}`}
                            setSelectKey={handleSelectKey} isLoading={isCardFilterLoading && selectKey === "Не рабочие компьютеры"}
                            isActive={selectKey === "Не рабочие компьютеры"}>
                            <RiComputerLine className="fill-primary dark:fill-white text-2xl" width="35" height="30" />
                        </CardDataStats>


                        <CardDataStats title="Интернет" total={`${infoCompData?.all_compyuters_with_net}`}
                            setSelectKey={handleSelectKey} isLoading={isCardFilterLoading && selectKey === "Интернет"}
                            isActive={selectKey === "Интернет"}>
                            <MdSignalWifiStatusbarConnectedNoInternet2 style={{ color: "#3C50E0" }}
                                className="fill-primary dark:fill-white text-2xl"
                                width="20" height="22" />
                        </CardDataStats>

                        <CardDataStats title="Нет интернета" total={`${infoCompData?.all_compyuters_with_no_net}`}
                            setSelectKey={handleSelectKey} isLoading={isCardFilterLoading && selectKey === "Нет интернета"}
                            isActive={selectKey === "Нет интернета"}>
                            <MdSignalWifiStatusbarConnectedNoInternet2 style={{ color: "#3C50E0" }}
                                className="fill-primary dark:fill-white text-2xl"
                                width="20" height="22" />
                        </CardDataStats>

                        <CardDataStats title="Веб-камеры" total={`${infoCompData?.all_compyuters_with_webcam}`}
                            setSelectKey={handleSelectKey} isLoading={isCardFilterLoading && selectKey === "Веб-камеры"}
                            isActive={selectKey === "Веб-камеры"}>
                            <RiWebcamLine className="fill-primary dark:fill-white text-2xl" width="35" height="30" />
                        </CardDataStats>


                        <CardDataStats title="Принтеры" total={`${infoCompData?.all_compyuters_with_printer}`}
                            setSelectKey={handleSelectKey} isLoading={isCardFilterLoading && selectKey === "Принтеры"}
                            isActive={selectKey === "Принтеры"}>
                            <AiOutlinePrinter className="fill-primary dark:fill-white text-2xl" width="35" height="30" />
                        </CardDataStats>

                        <CardDataStats title="Сканеры" total={`${infoCompData?.all_compyuters_with_scaner}`}
                            setSelectKey={handleSelectKey} isLoading={isCardFilterLoading && selectKey === "Сканеры"}
                            isActive={selectKey === "Сканеры"}>
                            <MdOutlineAdfScanner className="fill-primary dark:fill-white text-2xl" width="35"
                                height="30" />
                        </CardDataStats>

                        <CardDataStats title="МФУ" total={`${infoCompData?.all_compyuters_with_mfo}`}
                            setSelectKey={handleSelectKey} isLoading={isCardFilterLoading && selectKey === "МФУ"}
                            isActive={selectKey === "МФУ"}>
                            <TbFunctionFilled style={{ color: "#3C50E0" }}
                                className="fill-primary dark:fill-white text-2xl" width="35" height="30" />
                        </CardDataStats> */}

                    </div>

                    <div className='mt-6'>
                        {/* <MainTable /> */}
                        <ComputerTable checkedComputer={computerData} setDeleteCompForChecked={setDeleteCompForChecked}
                            isFiltered={!!selectKey} loadingFilter={loadingFilter || isCardFilterLoading}
                            allEmployeeCount={infoCompData?.all_employee_count ?? 0}
                            onShowAllEmployees={() => handleSelectKey(null)} />
                    </div>
                </> :

                <div className='grid grid-cols-12'>
                    <div className='col-span-3 '>
                        <Skeleton />
                    </div>
                    <div className='col-span-3 '>
                        <Skeleton />
                    </div>
                    <div className='col-span-3 '>
                        <Skeleton />
                    </div>
                    <div className='col-span-3 '>
                        <Skeleton />
                    </div>
                </div>

            }


        </>
    );
};

export default Main;
