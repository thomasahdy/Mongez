const AuthFooterLink = ({ text, linkText, href, className = "" }) => {
  const normalizedHref = href.startsWith("#") ? href : `#${href.replace(/^\//, "")}`;

  return (
    <div className={`text-center text-sm text-text-secondary ${className}`}>
      {text}{" "}
      <a
        href={normalizedHref}
        className="font-normal text-primary no-underline hover:!underline transition focus:outline-none"
      >
        {linkText}
      </a>
    </div>
  );
};

export default AuthFooterLink;
