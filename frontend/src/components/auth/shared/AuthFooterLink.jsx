<<<<<<< HEAD
=======
import { NavLink } from "react-router";

>>>>>>> feature/backen_latest
const AuthFooterLink = ({ text, linkText, href, className = "" }) => {
  const normalizedHref = href.startsWith("#") ? href : `#${href.replace(/^\//, "")}`;

  return (
    <div className={`text-center text-[13px] text-text-secondary ${className}`}>
      {text}{" "}
<<<<<<< HEAD
      <a
        href={normalizedHref}
        className="font-normal text-primary no-underline hover:!underline transition focus:outline-none"
      >
        {linkText}
      </a>
=======
      <NavLink
        to={href}
        className="font-semibold text-primary hover:underline transition focus:outline-none focus:ring-2 focus:ring-primary rounded-lg px-2 py-1"
      >
        {linkText}
      </NavLink>
>>>>>>> feature/backen_latest
    </div>
  );
};

export default AuthFooterLink;