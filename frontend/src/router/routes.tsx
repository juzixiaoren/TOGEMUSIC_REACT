import { createBrowserRouter } from "react-router-dom";
import LoginPage from "../pages/LoginPage/LoginPage";
import HomePage from "../pages/HomePage/HomePage";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <LoginPage />
    },
    {
        path: "/login",
        element: <LoginPage />
    },
    {
        path: "/home",
        element: <HomePage />
    }
]);