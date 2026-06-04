import { Fragment } from "react";
import { FaCheck } from "react-icons/fa";

const steps = ["Account", "Organization", "Space", "Invite"];

const RegisterStepper = ({ step }) => {
  return (
    <div className="flex items-center justify-center mb-6">
      {steps.map((label, index) => {
        const number = index + 1;
        const active = step === number;
        const done = step > number;

        return (
          <Fragment key={label}>
            <div className="flex flex-col items-center text-center">
              <div
<<<<<<< HEAD
                className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold border-2 transition ${
=======
                className={`w-9 h-9 flex items-center justify-center rounded-full text-[13px] font-bold border-2 transition-all duration-300 ${
>>>>>>> feature/backen_latest
                  done
                    ? "bg-success border-success text-white shadow-sm"
                    : active
                      ? "bg-primary border-primary text-white shadow-[0_0_0_3px_rgba(0,168,232,0.2)]"
                      : "border-border text-text-tertiary bg-white"
                }`}
              >
                {done ? <FaCheck className="text-[10px]" /> : number}
              </div>

              <div
<<<<<<< HEAD
                className={`mt-1 text-[10px] font-medium ${
=======
                className={`mt-1.5 text-[10px] font-medium transition-all duration-300 ${
>>>>>>> feature/backen_latest
                  active ? "text-primary font-semibold" : "text-text-tertiary"
                }`}
              >
                {label}
              </div>
            </div>

            {index < steps.length - 1 && (
<<<<<<< HEAD
              <div className={`w-10 h-0.5 mx-1.5 ${step > number ? "bg-success" : "bg-border"}`} />
=======
              <div className={`w-12 h-0.5 mx-2 transition-all duration-300 ${step > number ? "bg-success" : "bg-border"}`} />
>>>>>>> feature/backen_latest
            )}
          </Fragment>
        );
      })}
    </div>
  );
};

export default RegisterStepper;