import { Fragment } from "react";
import { FaCheck } from "react-icons/fa";

const steps = ["Account", "Organization", "Space", "Invite"];

const RegisterStepper = ({ step }) => {
  return (
    <div className="flex items-center justify-center mb-9">
      {steps.map((label, index) => {
        const number = index + 1;
        const active = step === number;
        const done = step > number;

        return (
          <Fragment key={label}>
            <div className="flex flex-col items-center text-center">
              <div
                className={`w-9 h-9 flex items-center justify-center rounded-full text-[13px] font-bold border-2 transition ${
                  done
                    ? "bg-success border-success text-white"
                    : active
                      ? "bg-primary border-primary text-white"
                      : "border-border text-text-tertiary bg-white"
                }`}
              >
                {done ? <FaCheck className="text-xs" /> : number}
              </div>

              <div
                className={`mt-1.5 text-[10px] font-medium ${
                  active ? "text-primary font-semibold" : "text-text-tertiary"
                }`}
              >
                {label}
              </div>
            </div>

            {index < steps.length - 1 && (
              <div className={`w-12 h-0.5 mx-2 ${step > number ? "bg-success" : "bg-border"}`} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
};

export default RegisterStepper;
