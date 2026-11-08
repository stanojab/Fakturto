import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { homePath, useAuth, type FirmRole } from "../auth";

type Props = {
  children: ReactNode;
  roles?: FirmRole[]; // if set, only these roles may open the page
};

// Protected route: not logged in → login page; wrong role → the user's home page
export default function RequireAuth({ children, roles }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p style={{ padding: 16 }}>Nalaganje …</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.firmRole)) return <Navigate to={homePath(user)} replace />;

  return children;
}
