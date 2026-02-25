import React, { useEffect, useState } from 'react';
import CardDataStats from '../../components/CardDataStats';
import { BASE_URL } from '../../utils/urls';
import { Compyuter, InfoComputerData } from '../../types/compyuters';
import axioss from '../../api/axios';
import { isAuthenticated } from '../../utils/auth';
import { Navigate } from 'react-router-dom';
import { FaComputer } from "react-icons/fa6";
import { AiOutlinePrinter } from "react-icons/ai"
import { MdOutlineAdfScanner, MdSignalWifiStatusbarConnectedNoInternet2 } from "react-icons/md";
import { RiComputerLine, RiWebcamLine } from "react-icons/ri";
import ComputerTable from '../../components/Tables/DataTable';
import Skeleton from '../../components/Skeleton/Skeleton';
import { TbFunctionFilled } from 'react-icons/tb';

const Main: React.FC = () => {
    const [computerData, setComputerData] = useState<Compyuter[]>([])
    const [selectKey, setSelectKey] = useState<string | null>("")

    const handleSelectKey = (key: string | null) => {
        setSelectKey(key);
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
                },
            })
            .then((response) => {
                setInfoCompData(response.data);
            })
            .catch((err) => console.log(err));
    }, []);


    useEffect(() => {
        if (!selectKey) return;

        setIsCardFilterLoading(true);
        setLoadingFilter(true);

        const delay = new Promise<void>(resolve => setTimeout(resolve, 200));

        const payload: Record<string, string> = { key: selectKey };
        if (selectKey && selectKey !== 'Все сотрудники') {
            payload.ppe_product_name = selectKey;
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
    }, [selectKey, deleteCompForChecked]);


    if (!isAuthenticated()) {
        return <Navigate to="/auth/signin" />
    }

    return (
        <>
            {infoCompData ?
                <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-5 2xl:gap-7.5">

                        <CardDataStats title="Все сотрудники" total={`${infoCompData?.all_employee_count}`}
                            setSelectKey={handleSelectKey} isLoading={isCardFilterLoading && selectKey === "Все сотрудники"}
                            isActive={selectKey === "Все сотрудники"}>
                            <FaComputer className="fill-primary dark:fill-white text-2xl" width="35" height="30" />
                        </CardDataStats>
                        {Object.keys(infoCompData?.due_product_counts || {}).map((title) => {
                            const count = infoCompData?.due_product_counts?.[title] ?? 0;

                            return (
                                <CardDataStats
                                    key={title}
                                    title={title}
                                    total={`${count}`}
                                    setSelectKey={handleSelectKey}
                                    isLoading={isCardFilterLoading && selectKey === title}
                                    isActive={selectKey === title}
                                >
                                    <RiComputerLine className="fill-primary dark:fill-white text-2xl" width="35" height="30" />
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
                            isFiltered={!!selectKey} loadingFilter={loadingFilter || isCardFilterLoading} />
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
