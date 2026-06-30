import { useDispatch, useSelector } from "react-redux";
import { toggleTheme } from "../../store/theme/themeSlice";
import ToggleSwitch from "../notifications/ToggleSwitch";

const ThemeSwitch = () => {
    const dispatch = useDispatch();

    const mode = useSelector((state) => state.theme.mode);

    return (
        <div className="flex items-center justify-between">
            <span>Dark Mode</span>

            <ToggleSwitch
                checked={mode === "dark"}
                onChange={() => dispatch(toggleTheme())}
            />
        </div>
    );
};

export default ThemeSwitch;