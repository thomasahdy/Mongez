import { NavLink } from "react-router";

const AuthFooterLink = ({ text, linkText, href, className = "" }) => {
  return (
    <div className={`text-center text-sm text-text-secondary ${className}`}>
      {text}{" "}
      <NavLink
        to={href}
        className="font-semibold text-primary hover:underline transition focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
      >
        {linkText}
      </NavLink>
    </div>
  );
};

export default AuthFooterLink;
