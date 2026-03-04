import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Loader from './common/Loader';
import PageTitle from './components/PageTitle';
import SignIn from './pages/Authentication/SignIn';
import SignUp from './pages/Authentication/SignUp';

import Calendar from './pages/Calendar';
import Chart from './pages/Chart';
import FormElements from './pages/Form/FormElements';
import FormLayout from './pages/Form/FormLayout';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Tables from './pages/Tables';
import Alerts from './pages/UiElements/Alerts';
import Buttons from './pages/UiElements/Buttons';
import DefaultLayout from './layout/DefaultLayout';
import Main from './pages/Dashboard/Main';
import AddCompyuter from './pages/AddCompyuter/AddCompyuter';
import 'antd/dist/reset.css';
import { ToastContainer } from 'react-toastify';
import PageCompyuter from "./pages/ViewCompyuter/PagaCompyuter.tsx";
import EditCompyuterPage from "./pages/EditCompyuter/EditCompyuterPage.tsx";
import AddItemPage from './pages/AddItem/AddItemPage.tsx';
import EditEmployeePage from './pages/EditEmployee/EditEmployeePage.tsx';
import AddEmployeePage from './pages/AddEmployee/AddEmployeePage.tsx';
import StatisticsPage from './pages/Statistics';
import PPEArrivalPage from './pages/PPEArrival';
import SignaturePage from './pages/Signature/SignaturePage.tsx';
import NastroykaPage from './pages/Nastroyka';
import 'primeicons/primeicons.css';
import { isAuthenticated } from './utils/auth';


function App() {
  const [loading, setLoading] = useState<boolean>(true);
  const { pathname } = useLocation();
  const role = (localStorage.getItem('role') || 'user').toLowerCase();
  const isAdmin = role === 'admin';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000);
  }, []);


  return loading ? (
    <Loader />
  ) : (
    <DefaultLayout>
      <Routes>
        <Route
          index element={
            <>
              <PageTitle title="Главная страница" />
              <Main />
            </>
          }
        />
        <Route
          path="/add-compyuter"
          element={
            <>
              <PageTitle title="Добавить компьютер" />
              <AddCompyuter />
            </>
          }
        />
        {/* <Route
          path="/all-computers"
          element={
            <>
              <PageTitle title="Компьютеры" />
              <AllComputers />
            </>
          }
        /> */}
        <Route
          path={`/edit-computer/:slug`}
          element={
            <>
              <PageTitle title="Редактирование компьютер" />
              <EditCompyuterPage />
            </>
          }
        />
        <Route
          path={`/edit-employee/:slug`}
          element={
            <>
              <PageTitle title="Редактирование сотрудника" />
              <EditEmployeePage />
            </>
          }
        />
        <Route
          path={`/item-view/:slug`}
          element={
            <>
              <PageCompyuter />
            </>
          }
        />
        <Route
          path={`/add-item/:slug`}
          element={
            <>
              <PageTitle title="Добавить средства защиты" />
              <AddItemPage />
            </>
          }
        />
        <Route
          path={`/signature/:id`}
          element={
            <>
              <PageTitle title="Подпись сотрудника" />
              <SignaturePage />
            </>
          }
        />
        <Route
          path="/add-employee"
          element={
            <>
              <PageTitle title="Добавить сотрудника" />
              <AddEmployeePage />
            </>
          }
        />
        <Route
          path="/ppe-arrival"
          element={
            isAuthenticated() ? (
              <>
                <PageTitle title="Прием СИЗ" />
                <PPEArrivalPage />
              </>
            ) : (
              <Navigate to="/auth/signin" replace />
            )
          }
        />
        <Route
          path="/statistics"
          element={
            isAuthenticated() ? (
              <>
                <PageTitle title="Статистика" />
                <StatisticsPage />
              </>
            ) : (
              <Navigate to="/auth/signin" replace />
            )
          }
        />
        <Route
          path="/nastroyka"
          element={
            isAuthenticated() ? (
              <>
                <PageTitle title="Настройки" />
                <NastroykaPage />
              </>
            ) : (
              <Navigate to="/auth/signin" replace />
            )
          }
        />
        <Route
          path="/tables"
          element={
            <>
              <PageTitle title="Tables | TailAdmin - Tailwind CSS Admin Dashboard Template" />
              <Calendar />
            </>
          }
        />
        <Route
          path="/calendar"
          element={
            <>
              <PageTitle title="Calendar | TailAdmin - Tailwind CSS Admin Dashboard Template" />
              <Calendar />
            </>
          }
        />
        <Route
          path="/profile"
          element={
            <>
              <PageTitle title="Profile | TailAdmin - Tailwind CSS Admin Dashboard Template" />
              <Profile />
            </>
          }
        />
        <Route
          path="/forms/form-elements"
          element={
            <>
              <PageTitle title="Form Elements | TailAdmin - Tailwind CSS Admin Dashboard Template" />
              <FormElements />
            </>
          }
        />
        <Route
          path="/forms/form-layout"
          element={
            <>
              <PageTitle title="Form Layout | TailAdmin - Tailwind CSS Admin Dashboard Template" />
              <FormLayout />
            </>
          }
        />
        <Route
          path="/tables"
          element={
            <>
              <PageTitle title="Tables | TailAdmin - Tailwind CSS Admin Dashboard Template" />
              <Tables />
            </>
          }
        />
        <Route
          path="/settings"
          element={
            <>
              <PageTitle title="Settings | TailAdmin - Tailwind CSS Admin Dashboard Template" />
              <Settings />
            </>
          }
        />
        <Route
          path="/chart"
          element={
            <>
              <PageTitle title="Basic Chart | TailAdmin - Tailwind CSS Admin Dashboard Template" />
              <Chart />
            </>
          }
        />
        <Route
          path="/ui/alerts"
          element={
            <>
              <PageTitle title="Alerts | TailAdmin - Tailwind CSS Admin Dashboard Template" />
              <Alerts />
            </>
          }
        />
        <Route
          path="/ui/buttons"
          element={
            <>
              <PageTitle title="Buttons | TailAdmin - Tailwind CSS Admin Dashboard Template" />
              <Buttons />
            </>
          }
        />
        <Route
          path="/auth/signin"
          element={
            <>
              <PageTitle title="Войти" />
              <SignIn />
            </>
          }
        />
        <Route
          path="/auth/signup"
          element={
            isAdmin ? (
              <>
                <PageTitle title="Регистрация" />
                <SignUp />
              </>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>
      <ToastContainer />
    </DefaultLayout>
    
  );
}

export default App;
