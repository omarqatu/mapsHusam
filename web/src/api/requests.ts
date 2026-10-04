import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { api } from './client';

// Service requests + chat (legacy js/service-chat.js). Shapes read from the handlers in server.js.
// The server takes the user from the token, so bodies never carry a user id or a role claim.

export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
/** Which side of a request someone is on. */
export type RequestRole = 'user' | 'provider';
/** `call` / `whatsapp` rows are logged by /api/log-contact-click (status `completed`, no chat). */
export type RequestContactType = 'service_request' | 'call' | 'whatsapp';

/** Contact numbers, present on the server's answers once a request is `completed` (never before). */
export interface ContactNumbers {
  userPhone?: string | null;
  userWhatsapp?: string | null;
  providerPhone?: string | null;
  providerWhatsapp?: string | null;
}

/** One row of GET /api/service-requests (`sr.*` + the joined names). */
export interface ServiceRequest extends ContactNumbers {
  id: number;
  user_id: number;
  provider_user_id: number;
  service_layer: string;
  feature_id: number | null;
  provider_name: string | null;
  service_type: string | null;
  status: RequestStatus;
  contact_type: RequestContactType;
  user_confirmed: boolean;
  provider_confirmed: boolean;
  cancellation_reason: string | null;
  /** The agreed time of the visit / viewing (ISO), set by either side; null = not set. */
  appointment_at: string | null;
  created_at: string;
  updated_at: string;
  /** Requester's account name; `user_name` is the same value under the name the legacy UI used. */
  requester_name: string | null;
  user_name: string | null;
  provider_full_name: string | null;
}

export interface ChatMessage {
  id: number;
  request_id: number;
  sender_role: RequestRole;
  sender_id: number;
  message: string;
  created_at: string;
}

export interface MessagesResponse extends ContactNumbers {
  success: boolean;
  messages: ChatMessage[];
  requestStatus: RequestStatus;
}

export interface PendingRating {
  id: number;
  service_type: string | null;
  provider_user_id: number;
  provider_name: string | null;
}
export interface PendingComment {
  /** The rating's own id (what the comment endpoint takes). */
  id: number;
  request_id: number;
  service_layer: string;
  feature_id: number;
  rating: number;
  provider_name: string | null;
}

/** Field limits enforced by the server (it truncates silently, so the UI stops the user earlier). */
export const REQUEST_LIMITS = { message: 1000, cancelReason: 300, comment: 500 } as const;

export interface CreateRequestBody {
  service_layer: string;
  feature_id: number;
  provider_name: string;
  service_type: string;
}

export const requestsApi = {
  mine: (uid: number) =>
    api.get<{ success: boolean; requests: ServiceRequest[] }>('/api/service-requests', { user_id: uid }),
  incoming: (uid: number) =>
    api.get<{ success: boolean; requests: ServiceRequest[] }>('/api/service-requests', {
      provider_user_id: uid,
      status: 'pending',
    }),
  create: (body: CreateRequestBody) =>
    api.post<{ success: boolean; requestId: number; status: RequestStatus }>('/api/service-requests', body),
  /** Accepting may fix the appointment at once (ISO time). */
  respond: (id: number, action: 'accept' | 'reject', appointmentAt?: string) =>
    api.post<{ success: boolean; status: RequestStatus; appointment_at?: string | null }>(
      `/api/service-requests/${id}/respond`,
      appointmentAt ? { action, appointment_at: appointmentAt } : { action },
    ),
  /** Sets, moves or (null) clears the appointment; the other side is notified. */
  setAppointment: (id: number, appointmentAt: string | null) =>
    api.post<{ success: boolean; appointment_at: string | null }>(`/api/service-requests/${id}/appointment`, {
      appointment_at: appointmentAt,
    }),
  cancel: (id: number, reason: string) =>
    api.post<{ success: boolean }>(`/api/service-requests/${id}/cancel`, { cancellation_reason: reason }),
  messages: (id: number) => api.get<MessagesResponse>(`/api/service-requests/${id}/messages`),
  sendMessage: (id: number, role: RequestRole, message: string) =>
    api.post<{ success: boolean; message: ChatMessage }>(`/api/service-requests/${id}/message`, {
      sender_role: role,
      message,
    }),
  confirm: (id: number, role: RequestRole) =>
    api.post<{ success: boolean; status: RequestStatus; waitingOtherSide?: boolean } & ContactNumbers>(
      `/api/service-requests/${id}/confirm`,
      { role },
    ),
  rate: (id: number, rating: number, comment: string) =>
    api.post<{ success: boolean }>(`/api/service-requests/${id}/rating`, {
      rating,
      comment: comment || null,
    }),
  comment: (ratingId: number, comment: string) =>
    api.put<{ success: boolean }>(`/api/service-ratings/${ratingId}/comment`, { comment }),
  pendingRatings: () =>
    api.get<{ success: boolean; pendingRatings: PendingRating[] }>('/api/service-requests/pending-ratings'),
  pendingComments: () =>
    api.get<{ success: boolean; pendingComments: PendingComment[] }>('/api/service-ratings/pending-comments'),
};

export const requestKeys = {
  all: ['service-requests'] as const,
  mine: (uid: number | undefined) => ['service-requests', 'mine', uid] as const,
  incoming: (uid: number | undefined) => ['service-requests', 'incoming', uid] as const,
  messages: (id: number | null) => ['service-requests', 'messages', id] as const,
  pendingRatings: ['service-requests', 'pending-ratings'] as const,
  pendingComments: ['service-requests', 'pending-comments'] as const,
};

const useUid = () => useAuthStore((s) => s.user?.user_id);

/** Every request I sent or received, newest first. */
export function useMyRequests(enabled = true) {
  const uid = useUid();
  return useQuery({
    queryKey: requestKeys.mine(uid),
    queryFn: () => requestsApi.mine(uid!),
    enabled: !!uid && enabled,
    staleTime: 30_000,
    select: (d) => d.requests ?? [],
  });
}

/**
 * A provider's pending queue. Sockets tell us about new requests (they invalidate this); the 15 s poll is the
 * safety net legacy had, and it pauses in a hidden tab.
 */
export function useIncomingRequests(enabled: boolean) {
  const uid = useUid();
  return useQuery({
    queryKey: requestKeys.incoming(uid),
    queryFn: () => requestsApi.incoming(uid!),
    enabled: !!uid && enabled,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    // Oldest first: the banner answers them in the order they came in.
    select: (d) => (d.requests ?? []).slice().sort((a, b) => a.id - b.id),
  });
}

/** A chat's messages. Sockets refresh it; the interval is a fallback while an active chat is open. */
export function useChatMessages(requestId: number | null, poll: boolean) {
  return useQuery({
    queryKey: requestKeys.messages(requestId),
    queryFn: () => requestsApi.messages(requestId!),
    enabled: requestId !== null,
    staleTime: 0,
    refetchInterval: poll ? 10_000 : false,
  });
}

/** Completed requests I sent and have not rated yet (one call instead of one check per card). */
export function usePendingRatings() {
  const uid = useUid();
  return useQuery({
    queryKey: requestKeys.pendingRatings,
    queryFn: requestsApi.pendingRatings,
    enabled: !!uid,
    staleTime: 60_000,
    select: (d) => d.pendingRatings ?? [],
  });
}

/** Ratings I gave without a comment. */
export function usePendingComments() {
  const uid = useUid();
  return useQuery({
    queryKey: requestKeys.pendingComments,
    queryFn: requestsApi.pendingComments,
    enabled: !!uid,
    staleTime: 60_000,
    select: (d) => d.pendingComments ?? [],
  });
}

/** Any change to a request moves the lists, the badges and (for ratings) the pending lists. */
function useInvalidateRequests() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: requestKeys.all });
}

export function useCreateRequest() {
  const invalidate = useInvalidateRequests();
  return useMutation({ mutationFn: requestsApi.create, onSuccess: invalidate });
}

export function useRespondToRequest() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: (v: { id: number; action: 'accept' | 'reject'; appointmentAt?: string }) =>
      requestsApi.respond(v.id, v.action, v.appointmentAt),
    // A 409/400 "already answered" means the queue is stale — refresh it either way.
    onSettled: invalidate,
  });
}

export function useSetAppointment() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: (v: { id: number; at: string | null }) => requestsApi.setAppointment(v.id, v.at),
    onSettled: invalidate,
  });
}

export function useCancelRequest() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: (v: { id: number; reason: string }) => requestsApi.cancel(v.id, v.reason),
    onSettled: invalidate,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: number; role: RequestRole; message: string }) =>
      requestsApi.sendMessage(v.id, v.role, v.message),
    onSuccess: (res, v) => {
      // Show my own message at once; the server only pushes messages to the OTHER side.
      qc.setQueryData<MessagesResponse>(requestKeys.messages(v.id), (old) =>
        old && !old.messages.some((m) => m.id === res.message.id)
          ? { ...old, messages: [...old.messages, res.message] }
          : old,
      );
    },
  });
}

export function useConfirmAgreement() {
  const qc = useQueryClient();
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: (v: { id: number; role: RequestRole }) => requestsApi.confirm(v.id, v.role),
    onSuccess: (_res, v) => {
      void qc.invalidateQueries({ queryKey: requestKeys.messages(v.id) });
      return invalidate();
    },
  });
}

export function useSubmitRating() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: (v: { id: number; rating: number; comment: string }) =>
      requestsApi.rate(v.id, v.rating, v.comment),
    onSuccess: invalidate,
  });
}

export function useSubmitComment() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: (v: { ratingId: number; comment: string }) => requestsApi.comment(v.ratingId, v.comment),
    onSuccess: invalidate,
  });
}
