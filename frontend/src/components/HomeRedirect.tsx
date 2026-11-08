import { Navigate } from "react-router";
import { homePath, useAuth } from "../auth";

// "/" → the home page of the logged-in user's role
export default function HomeRedirect() {
  const { user } = useAuth();
  return user ? <Navigate to={homePath(user)} replace /> : null;
}
