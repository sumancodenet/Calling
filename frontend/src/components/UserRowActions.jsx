import { useState } from "react";
import KebabMenu from "./KebabMenu.jsx";
import EditUserModal from "./EditUserModal.jsx";
import ChangePasswordModal from "./ChangePasswordModal.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import { auth, ApiError } from "../lib/api.js";
import { useToast } from "./Toast.jsx";

/**
 * The three-dot action button for a user row, and the three flows behind it.
 * Owning all three dialogs here means every users table gets edit / change
 * password / delete for free, with one consistent implementation.
 */
export const UserRowActions = ({ user, currentUserId, onChanged }) => {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const isSelf = Number(user.id) === Number(currentUserId);

  const confirmDelete = async () => {
    setBusy(true);
    try {
      const res = await auth.deleteUser(user.id);
      toast.success("User deleted", res.data.userName);
      setDeleting(false);
      onChanged?.();
    } catch (err) {
      toast.error("Could not delete user", err instanceof ApiError ? err.message : "Unexpected error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <KebabMenu
        label={`Actions for ${user.userName}`}
        items={[
          { key: "edit", label: "Edit", icon: "file", onSelect: () => setEditing(true) },
          { key: "password", label: "Change password", icon: "key", onSelect: () => setResetting(true) },
          {
            key: "delete",
            label: "Delete",
            icon: "alert",
            tone: "danger",
            // The API refuses these too, but hiding them avoids a dead-end click.
            disabled: isSelf,
            onSelect: () => setDeleting(true),
          },
        ]}
      />

      <EditUserModal open={editing} user={user} onClose={() => setEditing(false)} onChanged={onChanged} />
      <ChangePasswordModal open={resetting} user={user} onClose={() => setResetting(false)} onChanged={onChanged} />
      <ConfirmDialog
        open={deleting}
        title="Delete this user?"
        message={`${user.fullName} (${user.userName}) will lose access immediately and all their sessions will be signed out. This cannot be undone.`}
        confirmLabel="Delete user"
        confirmPhrase="delete"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(false)}
      />
    </>
  );
};

export default UserRowActions;
