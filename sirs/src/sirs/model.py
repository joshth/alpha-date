"""Modified SIRS with a feedback recovery rate (paper eqs. 5-7).

    dS/dt = -beta*S*I + xi*(1 - S - I)
    dI/dt =  beta*S*I - Gamma*I
    dGamma/dt = Gamma*(alpha*I - delta*S)

Gamma is integrated as log(Gamma), exactly as in the authors' code
(``dlngamma = (alpha*i - delta*s) dt``), so Gamma > 0 by construction.
With alpha = delta = 0 the recovery rate is constant: the standard SIRS
(constant-gamma ablation).

Time unit: 1 week.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.integrate import solve_ivp

I0_SEED = 1e-3  # initial infected share at onset (brief: S = 1 - 1e-3, I = 1e-3)


@dataclass(frozen=True)
class Params:
    beta: float
    xi: float
    alpha: float
    delta: float
    gamma0: float  # initial condition Gamma(0); reported, not interpreted

    def as_dict(self) -> dict:
        return {k: float(getattr(self, k)) for k in ("beta", "xi", "alpha", "delta", "gamma0")}


def rhs(t, y, beta, xi, alpha, delta):
    s, i, lng = y
    g = np.exp(min(lng, 30.0))  # Gamma > e^30 per week is already instant recovery; avoids overflow
    return [-beta * s * i + xi * (1.0 - s - i), beta * s * i - g * i, alpha * i - delta * s]


def simulate(p: Params, n_weeks: int, s0: float = 1.0 - I0_SEED, i0: float = I0_SEED,
             rtol: float = 1e-8, atol: float = 1e-11, method: str = "LSODA") -> dict:
    """Solve on the integer-week grid 0..n_weeks-1. Returns dict with S, I, Gamma, ok."""
    t_eval = np.arange(n_weeks, dtype=float)
    with np.errstate(all="ignore"):
        sol = solve_ivp(rhs, (0.0, float(n_weeks - 1)), [s0, i0, np.log(p.gamma0)], t_eval=t_eval,
                        method=method, rtol=rtol, atol=atol,
                        args=(p.beta, p.xi, p.alpha, p.delta))
    if not sol.success or sol.y.shape[1] != n_weeks:
        return {"ok": False, "S": None, "I": None, "Gamma": None, "msg": sol.message}
    S, I, lng = sol.y
    tol = 1e-6
    ok = bool(np.all(np.isfinite(sol.y)) and S.min() > -tol and I.min() > -tol
              and S.max() < 1 + tol and I.max() < 1 + tol and (S + I).max() < 1 + tol)
    return {"ok": ok, "t": t_eval, "S": S, "I": I, "Gamma": np.exp(lng), "msg": sol.message}


def fixed_point(beta: float, xi: float, alpha: float, delta: float) -> tuple[float, float, float]:
    """Unique interior fixed point X* (paper eq. 9). For alpha=delta=0 see ``sirs_fixed_point``."""
    a = alpha + delta
    s = (-a + np.sqrt(a * a + 4.0 * alpha * beta * delta / xi)) / (2.0 * beta * delta / xi)
    return float(s), float(delta / alpha * s), float(beta * s)


def sirs_fixed_point(beta: float, xi: float, gamma: float) -> tuple[float, float, float]:
    """Endemic equilibrium of the constant-gamma SIRS (disease-free if beta <= gamma)."""
    if beta <= gamma:
        return 1.0, 0.0, gamma
    s = gamma / beta
    return float(s), float(xi * (1.0 - s) / (xi + gamma)), float(gamma)


def is_unstable(beta: float, xi: float, alpha: float, delta: float) -> bool:
    """Proposition 1 (eq. 10): X* unstable iff alpha > beta + xi and
    delta >= alpha^2 xi / ((alpha - beta)(alpha - beta - xi))."""
    if alpha <= beta + xi:
        return False
    return delta >= alpha ** 2 * xi / ((alpha - beta) * (alpha - beta - xi))


def jacobian_eigenvalues(beta: float, xi: float, alpha: float, delta: float) -> np.ndarray:
    """Eigenvalues of the Jacobian of (S, I, Gamma) at X* (numerical cross-check of Prop. 1)."""
    s, i, g = fixed_point(beta, xi, alpha, delta)
    J = np.array([
        [-beta * i - xi, -beta * s - xi, 0.0],
        [beta * i, beta * s - g, -i],
        [-delta * g, alpha * g, alpha * i - delta * s],
    ])
    return np.linalg.eigvals(J)


def hopf_alpha(beta: float, xi: float) -> float:
    """Restricted model (alpha = delta) Hopf point (Prop. 2): alpha = beta + xi + sqrt(xi(beta+xi))."""
    return beta + xi + np.sqrt(xi * (beta + xi))


def describe(p: Params, constant_gamma: bool = False) -> dict:
    """Fixed point and stability region for a parameter set."""
    if constant_gamma:
        s, i, g = sirs_fixed_point(p.beta, p.xi, p.gamma0)
        return {"S_star": s, "I_star": i, "Gamma_star": g, "region": "stable",
                "note": "constant-gamma SIRS: endemic equilibrium is always locally stable"}
    s, i, g = fixed_point(p.beta, p.xi, p.alpha, p.delta)
    unstable = is_unstable(p.beta, p.xi, p.alpha, p.delta)
    eig = jacobian_eigenvalues(p.beta, p.xi, p.alpha, p.delta)
    return {"S_star": s, "I_star": i, "Gamma_star": g,
            "region": "unstable" if unstable else "stable",
            "max_eig_real": float(np.max(eig.real))}
