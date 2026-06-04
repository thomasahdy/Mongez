import { NavLink } from "react-router";

const AuthFooterLink = ({ text, linkText, href, className = "" }) => {
  return (
    <div className={`text-center text-[13px] text-text-secondary ${className}`}>
      {text}{" "}
      <NavLink
        to={href}
        className="font-semibold text-primary hover:underline transition focus:outline-none focus:ring-2 focus:ring-primary rounded-lg px-2 py-1"
      >
        {linkText}
      </NavLink>
    </div>
  );
};

export default AuthFooterLink;