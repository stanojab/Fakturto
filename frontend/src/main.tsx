import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider } from "./auth";
import HomeRedirect from "./components/HomeRedirect";
import RequireAuth from "./components/RequireAuth";
import Layout from "./Layout";
import ClientsPage from "./pages/ClientsPage";
import LoginPage from "./pages/LoginPage";
import MyInvoicesPage from "./pages/MyInvoicesPage";
import ReviewPage from "./pages/ReviewPage";
import ReviewQueuePage from "./pages/ReviewQueuePage";
import UploadPage from "./pages/UploadPage";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<HomeRedirect />} />
            <Route
              path="/clients"
              element={
                <RequireAuth roles={["ADMIN"]}>
                  <ClientsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/invoices"
              element={
                <RequireAuth roles={[null]}>
                  <MyInvoicesPage />
                </RequireAuth>
              }
            />
            <Route path="/upload" element={<UploadPage />} />
            <Route
              path="/review"
              element={
                <RequireAuth roles={["ACCOUNTANT", "ADMIN"]}>
                  <ReviewQueuePage />
                </RequireAuth>
              }
            />
            <Route
              path="/review/:id"
              element={
                <RequireAuth roles={["ACCOUNTANT", "ADMIN"]}>
                  <ReviewPage />
                </RequireAuth>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
