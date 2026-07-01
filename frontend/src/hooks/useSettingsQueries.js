import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDispatch, useStore } from "react-redux";
import calendarService from "../services/api/calendarService";
import integrationsService from "../services/api/integrationsService";
import membersService from "../services/api/membersService";
import userService from "../services/api/userService";
import { leaveSpace } from "../services/api/spacesService";
import { setAuthSession } from "../store/auth/authSlice";
import { setTheme } from "../store/theme/themeSlice";
import { runLanguageTransition } from "../utils/languageTransition";
import i18n from "../i18n";

const SETTINGS_PROFILE_QUERY_KEY = ["settings", "profile"];
const AUTH_SESSION_QUERY_KEY = ["auth", "session"];

function resolveThemeMode(theme) {
  if (theme !== "system") {
    return theme;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function invalidateUserSurfaceQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: SETTINGS_PROFILE_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: ["settings", "members"] });
  queryClient.invalidateQueries({ queryKey: ["members"] });
  queryClient.invalidateQueries({ queryKey: ["board"] });
  queryClient.invalidateQueries({ queryKey: ["boards"] });
  queryClient.invalidateQueries({ queryKey: ["tasks"] });
  queryClient.invalidateQueries({ queryKey: ["task"] });
}

export function useSettingsProfileQuery() {
  return useQuery({
    queryKey: SETTINGS_PROFILE_QUERY_KEY,
    queryFn: async () => {
      const [profile, preferences] = await Promise.all([
        userService.getCurrentUser(),
        userService.getUserPreferences(),
      ]);

      return {
        profile,
        preferences,
      };
    },
  });
}

export function useUpdateProfileMutation() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => userService.updateProfile(payload),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(SETTINGS_PROFILE_QUERY_KEY, (current) => ({
        ...(current || {}),
        profile: updatedUser,
      }));
      dispatch(
        setAuthSession({
          user: updatedUser,
          isAuthenticated: true,
        }),
      );
      invalidateUserSurfaceQueries(queryClient);
    },
  });
}

export function useUpdatePreferencesMutation() {
  const dispatch = useDispatch();
  const store = useStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => userService.updateUserPreferences(payload),
    onSuccess: (updatedPreferences, variables) => {
      const currentUser = store.getState()?.users?.user || null;
      queryClient.setQueryData(SETTINGS_PROFILE_QUERY_KEY, (current) => ({
        ...(current || {}),
        preferences: updatedPreferences,
      }));

      if (currentUser && (updatedPreferences?.language || variables?.language)) {
        const nextLanguage = updatedPreferences?.language || variables.language;
        dispatch(
          setAuthSession({
            user: {
              ...currentUser,
              language: nextLanguage,
            },
            isAuthenticated: true,
          }),
        );
        runLanguageTransition(nextLanguage, () => {
          document.documentElement.dir = nextLanguage === "ar" ? "rtl" : "ltr";
          document.documentElement.lang = nextLanguage;
          window.localStorage.setItem("mongez.language", nextLanguage);
          void i18n.changeLanguage(nextLanguage);
        });
      }

      if (updatedPreferences?.theme || variables?.theme) {
        const nextTheme = updatedPreferences?.theme || variables.theme;
        dispatch(setTheme(resolveThemeMode(nextTheme)));
      }

      queryClient.invalidateQueries({ queryKey: SETTINGS_PROFILE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY });
    },
  });
}

export function useIntegrationStatusesQuery(spaceId) {
  return useQuery({
    queryKey: ["settings", "integrations", spaceId || "global"],
    queryFn: () => integrationsService.getIntegrationStatuses(spaceId),
  });
}

export function useDisconnectGoogleDriveMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => integrationsService.disconnectGoogleDrive(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "integrations", spaceId || "global"] });
    },
  });
}

export function useGoogleDriveConnectAction() {
  return useCallback(() => {
    window.location.href = integrationsService.getGoogleDriveAuthUrl();
  }, []);
}

export function useGoogleCalendarConnectMutation() {
  return useMutation({
    mutationFn: (spaceId) => calendarService.connectGoogleCalendar(spaceId),
  });
}

export function useGoogleCalendarSyncMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => calendarService.syncGoogleCalendar(spaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "integrations", spaceId || "global"] });
    },
  });
}

export function useSpaceMembersQuery(spaceId) {
  return useQuery({
    queryKey: ["settings", "members", spaceId],
    queryFn: () => membersService.getMembers(spaceId),
    enabled: Boolean(spaceId),
  });
}

export function useSpaceInvitationsQuery(spaceId) {
  return useQuery({
    queryKey: ["settings", "invitations", spaceId],
    queryFn: async () => {
      try {
        const data = await membersService.getPendingInvitations(spaceId);
        return {
          items: Array.isArray(data) ? data : [],
          canViewInvitations: true,
        };
      } catch (error) {
        if (error?.response?.status === 403 || error?.status === 403) {
          return {
            items: [],
            canViewInvitations: false,
          };
        }

        throw error;
      }
    },
    enabled: Boolean(spaceId),
    retry: false,
  });
}

export function useInviteSpaceMemberMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => membersService.inviteMember(spaceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "invitations", spaceId] });
    },
  });
}

export function useUpdateSpaceMemberRoleMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }) => membersService.updateMemberRole(spaceId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "members", spaceId] });
    },
  });
}

export function useRemoveSpaceMemberMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId) => membersService.removeMember(spaceId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "members", spaceId] });
    },
  });
}

export function useRevokeSpaceInvitationMutation(spaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId) => membersService.cancelInvitation(spaceId, inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "invitations", spaceId] });
    },
  });
}

export function useLeaveSpaceMutation(spaceId) {
  return useMutation({
    mutationFn: () => leaveSpace(spaceId),
  });
}

export function useUploadAvatarMutation() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file) => userService.uploadAvatar(file),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(SETTINGS_PROFILE_QUERY_KEY, (current) => ({
        ...(current || {}),
        profile: updatedUser,
      }));
      dispatch(
        setAuthSession({
          user: updatedUser,
          isAuthenticated: true,
        }),
      );
      invalidateUserSurfaceQueries(queryClient);
    },
  });
}
