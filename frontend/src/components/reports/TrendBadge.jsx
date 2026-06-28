import React from "react";
import useLocaleDirection from "../../hooks/useLocaleDirection";

const TrendBadge = ({ direction, label, isPositive }) => {
  const { dir } = useLocaleDirection();
  const isGood = direction === "up" ? (isPositive !== false) : isPositive === true;
  const colorClass = isGood ? "text-emerald-500" : "text-red-500";
  const arrowIcon = direction === "up" ? "fa-arrow-up" : "fa-arrow-down";

  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${colorClass}`} dir={dir}>
      <i className={`fa-solid ${arrowIcon} text-[10px]`} aria-hidden="true" />
      {label}
    </span>
  );
}

export default TrendBadge
