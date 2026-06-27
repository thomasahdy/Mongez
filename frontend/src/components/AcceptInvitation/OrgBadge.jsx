import React from 'react'

const OrgBadge = ({ name }) => {
  return (
    <div className="inline-flex items-center gap-2 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-300 px-4 py-2 rounded-full text-[12px] font-semibold mb-5">
      <i className="fa-solid fa-building text-[13px]" aria-hidden="true" />
      {name}
    </div>
  );
}

export default OrgBadge
