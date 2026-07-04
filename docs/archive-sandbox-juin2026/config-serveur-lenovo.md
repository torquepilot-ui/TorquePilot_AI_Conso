# Configuration Serveur Lenovo — ThinkCentre M720q

> Dernière mise à jour : 13 juin 2026
> Rôle : Serveur IA local (Hermes, Ollama, Docker)

---

## Matériel

| Composant | Détail |
|---|---|
| **Modèle** | Lenovo ThinkCentre M720q (M1UKT1FA) |
| **CPU** | Intel Core i3-8100T @ 3.10 GHz (4 cœurs, 1 socket) |
| **RAM** | 16 Go (15 Gi) — ~10 Go dispo |
| **GPU** | Intel UHD Graphics 630 (CoffeeLake-S GT2) |
| **Stockage** | NVMe 512 Go — 90 Go utilisés / 344 Go libres |
| **Réseau** | Ethernet `eno1` — IP locale `192.168.1.50/24` |
| **Fabrication** | Septembre 2018 (7 ans) |

---

## OS & Kernel

```
Ubuntu 24.04.4 LTS (Noble Numbat)
Kernel 6.17.0-22-generic
Architecture x86-64
Hostname: torquepilot-ThinkCentre-M720q
```

---

## Réseau

| Interface | IP | Rôle |
|---|---|---|
| `eno1` | 192.168.1.50/24 | LAN principal |
| `tailscale0` | 100.84.234.6 | VPN Tailscale |
| `wg0` | 10.0.0.1/24 | WireGuard |
| `docker0` | 172.17.0.1/16 | Docker bridge |
| `br-*` | 172.18-20.0.1/16 | Bridges Docker divers |

---

## Services Docker

| Conteneur | Status | Port |
|---|---|---|
| `ollama` | Up (9 jours) | 127.0.0.1:11434 |
| `portainer` | Up (9 jours) | 127.0.0.1:9000, :9443 |
| `openwebui` | Up (9 jours, healthy) | 127.0.0.1:3000 |
| `openclaw_qdrant` | Up (9 jours) | 127.0.0.1:6333-6334 |

---

## Sauvegarde NAS

| Détail | Valeur |
|---|---|
| **NAS** | Synology 192.168.1.113 |
| **Partage** | `//192.168.1.113/backup_lenovo` (SMB) |
| **Point montage** | `/mnt/synology_backup` |
| **Capacité** | 1 To — 29 Go utilisés |
| **Outil** | Restic (dépôt `/mnt/synology_backup/restic_lenovo_main`) |

---

## Projets

| Projet | Chemin |
|---|---|
| TorquePilot AI Conso | `/home/torquepilot/projects/TorquePilot_AI_Conso_rudy-sandbox` |
