import BrandLogo from "../../branding/BrandLogo";

const AuthLogo = ({ className = "mb-10" }) => {
  return (
    <div className={`mb-8 flex justify-center ${className}`}>
      <BrandLogo
        to="/"
        markWrapperClassName="flex h-14 w-14 items-center justify-center rounded-xl"
        markClassName="h-14 w-14 object-contain"
        wordmarkClassName="h-12 w-auto object-contain"
      />
    </div>
  );
};

export default AuthLogo;
