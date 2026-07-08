import { useNavigate, useParams } from "react-router-dom";
import logoUrl from "@/assets/favicon.svg";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toggleTheme } from "@/store/slices/uiSlice";
import { logout } from "@/store/slices/authSlice";
import { IconSun, IconMoon, IconLogout } from "@/assets/icons";
import { getAvatarColor, getInitials } from "@/utils/helpers";
import { ROUTES } from "@/constants/routes";
import styles from "./CandidateHeader.module.css";

interface CandidateHeaderProps {
  candidateName?: string;
}

export default function CandidateHeader({ candidateName }: Readonly<CandidateHeaderProps>) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { shareLink } = useParams<{ shareLink: string }>();
  const theme = useAppSelector((state) => state.ui.theme);
  const isDark = theme === "dark";

  const handleLogout = () => {
    dispatch(logout());
    navigate(shareLink ? `${ROUTES.CANDIDATE.LOGIN}?share=${shareLink}` : ROUTES.CANDIDATE.LOGIN, {
      replace: true,
    });
  };

  return (
    <header className={styles.header}>
      {/* Left — logo + brand name */}
      <div className={styles.left}>
        <img src={logoUrl} width={31} height={31} alt="Talentia" className={styles.logoImg} />
        <span className={styles.companyName}>Talentia</span>
      </div>

      {/* Right — avatar, candidate info, theme toggle */}
      <div className={styles.right}>
        <button
          className={styles.themeButton}
          onClick={() => dispatch(toggleTheme())}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          type="button"
        >
          {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
        </button>
        {candidateName && (
          <>
            <div
              className={styles.avatar}
              style={{ background: getAvatarColor(candidateName) }}
              aria-hidden="true"
            >
              {getInitials(candidateName).charAt(0)}
            </div>
            <div className={styles.candidateInfo}>
              <span className={styles.candidateName}>{candidateName}</span>
              <span className={styles.roleLabel}>Candidate</span>
            </div>
          </>
        )}
        <button
          className={styles.logoutButton}
          onClick={handleLogout}
          aria-label="Log out"
          type="button"
        >
          <IconLogout size={18} />
        </button>
      </div>
    </header>
  );
}
