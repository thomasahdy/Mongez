import BrandLogo from "../branding/BrandLogo";

const AuthLogo = ({ href = "/" }) => {
  return (
    <BrandLogo
      to={href}
      ariaLabelKey="landing.nav.homeAria"
      markWrapperClassName="flex h-10 w-10 items-center justify-center rounded-xl"
      markClassName="h-8 w-7 object-contain"
      wordmarkClassName="h-10 w-auto object-contain"
    />
  );
};

export default AuthLogo;
