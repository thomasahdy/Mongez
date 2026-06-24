import { NavLink } from "react-router";
import mongezWordmark from "../../../assets/Mongez.svg";
import mongezMark from "../../../assets/MongezMLogo.svg";

const AuthLogo = ({ className = "mb-10" }) => {
  return (
      <div className="flex justify-center mb-8">
       <a href="/" className="flex items-center gap-1 text-slate-900">
              <div className="grid h-10 w-10 place-items-center rounded-xl">
                <img src={mongezMark} alt="Mongez mark" className="h-11 w-11 object-contain" />
              </div>
              <img src={mongezWordmark} alt="Mongez" className="h-13 w-auto object-contain" />
            </a>
      </div>
  );
};

export default AuthLogo;
