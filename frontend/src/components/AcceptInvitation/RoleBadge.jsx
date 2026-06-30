
const RoleBadge = ({ role }) => {
  return (
    <span className="inline-block bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
      {role}
    </span>
  );
  
}

export default RoleBadge
