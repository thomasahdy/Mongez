const AVATAR_COLORS = ["00a8e8", "10b981", "f59e0b", "ef4444", "6366f1", "0ea5e9"]

const getAvatarColor = (name) => {
    if (!name) return AVATAR_COLORS[0]

    const hash = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)

    return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

const humanizeValue = (value) => {
    if (value === null || value === undefined || value === "") {
        return "Unknown"
    }

    if (typeof value === "string") {
        return value
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value)
    }

    if (Array.isArray(value)) {
        return value.map(humanizeValue).join(", ")
    }

    if (typeof value === "object") {
        return (
            value.name ??
            value.title ??
            value.fullName ??
            value.label ??
            value.email ??
            value.id ??
            "Unknown"
        )
    }

    return "Unknown"
}

const formatText = (value) => {
    if (typeof value !== "string") {
        return humanizeValue(value)
    }

    return value
        .replace(/[_-]+/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^./, (char) => char.toUpperCase())
}

const getActionMeta = (rawAction = "") => {
    const action = String(rawAction).toLowerCase()

    if (action.includes("delete") || action.includes("remove")) {
        return { label: "Delete", icon: "fa-trash", className: "action-delete" }
    }

    if (action.includes("create") || action.includes("add") || action.includes("invite")) {
        return { label: "Create", icon: "fa-plus", className: "action-create" }
    }

    if (action.includes("login") || action.includes("sign in") || action.includes("signin")) {
        return {
            label: "Login",
            icon: "fa-right-to-bracket",
            className: "action-login",
        }
    }

    if (action.includes("permission") || action.includes("role")) {
        return {
            label: "Permission",
            icon: "fa-user-shield",
            className: "action-permission",
        }
    }

    if (action.includes("update") || action.includes("edit") || action.includes("change")) {
        return { label: "Update", icon: "fa-pen", className: "action-update" }
    }

    return {
        label: formatText(rawAction) || "Activity",
        icon: "fa-clipboard-list",
        className: "action-update",
    }
}

const getActorName = (log) => {
    return (
        log?.user?.fullName ??
        log?.user?.name ??
        log?.user?.displayName ??
        log?.actorName ??
        log?.actor ??
        log?.userName ??
        log?.user?.email ??
        "Unknown user"
    )
}

const getActorImage = (log, actorName) => {
    return (
        log?.user?.avatarUrl ??
        log?.user?.avatar ??
        `https://ui-avatars.com/api/?name=${encodeURIComponent(actorName)}&background=${getAvatarColor(actorName)}&color=fff`
    )
}

const getResourceLabel = (log) => {
    const resource =
        log?.resourceLabel ??
        log?.resource ??
        log?.entityLabel ??
        log?.entityName ??
        log?.entityType ??
        "Activity"

    const entityId = log?.entityId ?? log?.resourceId ?? log?.taskId
    const title = log?.title ?? log?.name

    if (title) {
        return `${formatText(resource)} "${humanizeValue(title)}"`
    }

    if (entityId && resource !== entityId) {
        return `${formatText(resource)} ${entityId}`
    }

    return formatText(resource)
}

const formatTimestamp = (value) => {
    if (!value) return "Unknown"

    const date = value instanceof Date ? value : new Date(value)

    if (Number.isNaN(date.getTime())) {
        return humanizeValue(value)
    }

    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date)
}

const formatDetailParts = (value) => {
    if (value === null || value === undefined || value === "") {
        return null
    }

    if (typeof value === "string") {
        return <>{value}</>
    }

    if (Array.isArray(value)) {
        return <>{value.map(humanizeValue).join(", ")}</>
    }

    if (typeof value !== "object") {
        return <>{humanizeValue(value)}</>
    }

    const field = value.field ?? value.property ?? value.key
    const from = value.from ?? value.before
    const to = value.to ?? value.after
    const note = value.note ?? value.message ?? value.description

    if ((field || from !== undefined || to !== undefined) && (from !== undefined || to !== undefined)) {
        return (
            <>
                {field ? `${formatText(field)} ` : ""}
                from <strong>{humanizeValue(from)}</strong> to <strong>{humanizeValue(to)}</strong>
            </>
        )
    }

    if (note) {
        return <>{note}</>
    }

    if (value.changes && typeof value.changes === "object") {
        const changes = value.changes
        const keys = Object.keys(changes)

        if (keys.length > 0) {
            const firstKey = keys[0]
            const change = changes[firstKey]
            const changeFrom = change?.from ?? change?.before
            const changeTo = change?.to ?? change?.after

            if (changeFrom !== undefined || changeTo !== undefined) {
                return (
                    <>
                        {formatText(firstKey)} from <strong>{humanizeValue(changeFrom)}</strong> to{" "}
                        <strong>{humanizeValue(changeTo)}</strong>
                    </>
                )
            }
        }
    }

    if (value.before !== undefined || value.after !== undefined) {
        return (
            <>
                from <strong>{humanizeValue(value.before)}</strong> to <strong>{humanizeValue(value.after)}</strong>
            </>
        )
    }

    return <>{humanizeValue(value)}</>
}

const getDetailContent = (log) => {
    const candidates = [
        log?.details,
        log?.message,
        log?.description,
        log?.summary,
        log?.diff,
    ]

    for (const candidate of candidates) {
        const detail = formatDetailParts(candidate)

        if (detail) {
            return detail
        }
    }

    return <>No additional details</>
}

const AuditTableRow = ({ log = {} }) => {
    const actorName = getActorName(log)
    const actionMeta = getActionMeta(log?.action ?? log?.type ?? log?.event)
    const resourceLabel = getResourceLabel(log)
    const timestamp = formatTimestamp(log?.timestamp ?? log?.createdAt ?? log?.date)
    const ipAddress = log?.ipAddress ?? log?.ip ?? "N/A"

return (
    <tr className="border-t border-gray-200">
        <td className="px-4 py-3">
            <div className="log-actor flex items-center gap-2">
                <img
                    src={getActorImage(log, actorName)}
                    alt={actorName}
                    className="h-8 w-8 rounded-full object-cover"
                />
                <span className="font-medium text-gray-900">{actorName}</span>
            </div>
        </td>
        <td className="px-4 py-3">
            <span className={`log-action-badge ${actionMeta.className} inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium`}>
                <i className={`fa-solid ${actionMeta.icon}`}></i>
                {actionMeta.label}
            </span>
        </td>
        <td className="log-target px-4 py-3 font-medium text-gray-900">
            {resourceLabel}
        </td>
        <td className="px-4 py-3 text-gray-600">
            {getDetailContent(log)}
        </td>
        <td className="log-ip px-4 py-3 text-gray-600">
            {ipAddress}
        </td>
        <td className="log-timestamp px-4 py-3 text-gray-600">
            {timestamp}
        </td>
    </tr>
);
};

export default AuditTableRow;
