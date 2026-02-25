import Breadcrumb from '../../components/Breadcrumbs/Breadcrumb';
import {Link, Navigate, useParams} from 'react-router-dom';
import { isAuthenticated } from '../../utils/auth';
import { Tabs } from 'flowbite-react';
import ViewCompyuter from "./ViewCompyuter.tsx";
import ViewPO from "./ViewPO.tsx";
import {FaLongArrowAltLeft} from "react-icons/fa";
import {GrAddCircle} from "react-icons/gr";



const PageCompyuter = () => {
      const { slug } = useParams()


  const customTheme = {

    tablist: {
      tabitem: {
        base: "p-4",
        active: {
          on: "border-b-2 border-red-500",
          off: "border-transparent",
        },
      },
    },
  };

  if (!isAuthenticated()) {
    return <Navigate to="/auth/signin" />
  }
  return (
    <>
      <Breadcrumb pageName="Информация о сотрудниках" />


      <div className="grid grid-cols-1 sm:grid-cols-4">

        <div className="col-span-4">
          <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="max-w-full m-4">
              <Tabs aria-label="Tabs example" theme={customTheme}>
                <Tabs.Item active title="Персональные данные">
                  <ViewCompyuter />
                </Tabs.Item>
                <Tabs.Item title="Средства защиты">
                  <ViewPO />
                </Tabs.Item>
              </Tabs>
            </div>
            <div className="flex justify-between border-b border-stroke py-4 px-6.5 dark:border-strokedark">
              <Link to={`/`} type='submit' className="flex items-center justify-center gap-2 rounded-md bg-slate-500 py-2 px-3 text-center font-medium text-white hover:bg-opacity-90 lg:px-5 xl:px-5" >
                < FaLongArrowAltLeft className='text-xl' />
                Назад
              </Link>
              <Link to={`/add-item/${slug}`} type='submit' className="flex items-center justify-center gap-2 rounded-md bg-meta-3 py-2 px-3 text-center font-medium text-white hover:bg-opacity-90 lg:px-5 xl:px-7" >
                <GrAddCircle className='text-xl' />
                Добавить
              </Link>

            </div>
          </div>
        </div >
      </div >
    </>
  );
};

export default PageCompyuter;
