import { openPermissionSettings, restartApp } from "../lib/ipc";
import { useT } from "../i18n";

/** macOS: explains how to grant Screen Recording and restart. */
export default function PermissionDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <div className="drawer-backdrop center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-labelledby="perm-title">
        <h2 id="perm-title">{t.permission.title}</h2>
        <p>{t.permission.body}</p>
        <ol>
          <li>{t.permission.step1}</li>
          <li>{t.permission.step2}</li>
          <li>{t.permission.step3}</li>
        </ol>
        <div className="row end">
          <button onClick={onClose}>{t.common.close}</button>
          <button onClick={() => openPermissionSettings()}>{t.permission.openSettings}</button>
          <button className="primary" onClick={() => restartApp()}>{t.permission.restart}</button>
        </div>
      </div>
    </div>
  );
}
