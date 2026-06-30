import useLocaleDirection from "../../hooks/useLocaleDirection";

const SecurityEmptyState = ({ icon, title, description }) => {
    const { dir } = useLocaleDirection();

    return (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center" dir={dir}>
            <div className="flex flex-col items-center gap-3">
                {icon && (
                    <div className="text-gray-400">
                        <i className={`${icon} text-2xl`}></i>
                    </div>
                )}
                <div className="space-y-1">
                    <h3 className="text-sm font-medium text-gray-900"> {title} </h3>
                    <p className="mx-auto max-w-sm text-sm text-gray-500"> {description} </p>
                </div>
            </div>
        </div>
    );
};

export default SecurityEmptyState;
