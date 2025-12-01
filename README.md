# MetaDAO Programs

![License BUSLv1.1](https://img.shields.io/badge/License-BUSLv1.1-lightgray.svg)

Programs for unruggable capital formation and market-driven governance.

## Deployments

| program           | tag  | program ID                                   |
| ----------------- | ---- | -------------------------------------------- |
| futarchy          | v0.6.0 | FUTARELBfJfQ8RDGhg1wdhddq1odMAJUePHFuBYfUxKq |
| launchpad_v7      | v0.7.0 | moontUzsdepotRGe5xsfip7vLPTJnVuafqdUWexVnPM |
| launchpad         | v0.6.0 | MooNyh4CBUYEKyXVnjGYQ8mEiJDpGvJMdvrZx1iGeHV |
| price_based_performance_package | v0.6.0 | pbPPQH7jyKoSLu8QYs3rSY3YkDRXEBojKbTgnUg7NDS |
| launchpad         | v0.5.0 | mooNhciQJi1LqHDmse2JPic2NqG2PXCanbE3ZYzP3qA |
| autocrat          | v0.5.0 | auToUr3CQza3D4qreT6Std2MTomfzvrEeCC5qh7ivW5 |
| amm               | v0.5.0 | AMMJdEiCCa8mdugg6JPF7gFirmmxisTfDJoSNSUi5zDJ |
| launchpad         | delayed-twap-v0.4.1 | AfJJJ5UqxhBKoE3grkKAZZsoXDE9kncbMKvqSHGsCNrE |
| autocrat          | proposal-duration-v0.4.2 | autowMzCbM29YXMgVG3T62Hkgo7RcyrvgQQkd54fDQL  |
| amm               | delayed-twap-v0.4.1 | AMMyu265tkBpRW21iGQxKGLaves3gKm2JcMUqfXNSpqD |
| conditional_vault | v0.4 | VLTX1ishMBbcX3rdBWGssxawAo1Q2X2qxYFYqiGodVg  |
| autocrat          | v0.3 | autoQP9RmUNkzzKRXsMkWicDVZ3h29vvyMDcAYjCxxg  |
| amm               | v0.3 | AMM5G2nxuKUwCLRYTW7qqEwuoqCtNSjtbipwEmm2g8bH |
| conditional_vault | v0.3 | VAU1T7S5UuEHmMvXtXMVmpEoQtZ2ya7eRb7gcN47wDp  |
| autocrat_v0       | v0.2 | metaRK9dUBnrAdZN6uUDKvxBVKW5pyCbPVmLtUZwtBp  |
| autocrat_migrator | v0.2 | MigRDW6uxyNMDBD8fX2njCRyJC4YZk2Rx9pDUZiAESt  |
| conditional_vault | v0.2 | vAuLTQjV5AZx5f3UgE75wcnkxnQowWxThn1hGjfCVwP  |
| autocrat_v0       | v0.1 | metaX99LHn3A7Gr7VAcCfXhpfocvpMpqQ3eyp3PGUUq  |
| autocrat_migrator | v0.1 | migkwAXrXFN34voCYQUhFQBXZJjHrWnpEXbSGTqZdB3  |
| autocrat_v0       | v0   | meta3cxKzFBmWYgCVozmvCQAS3y9b3fGxrG9HkHL7Wi  |
| conditional_vault | v0   | vaU1tVLj8RFk7mNj1BxqgAsMKKaL8UvEUHvU3tdbZPe  |

## Development Setup

### Prerequisites

Before you can build and test the programs, you'll need to install the following tools:

- **Rust**: 1.78.0 or compatible
- **Solana CLI**: 1.17.34 or compatible
- **Anchor CLI**: 0.29.0
- **Node.js**: 16.x or higher (tested with v23.x)
- **Yarn**: 1.22.22 or compatible

### MacOS Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/metaDAOproject/programs.git
cd programs
```

#### 2. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup install 1.78.0
rustup default 1.78.0
```

#### 3. Install Solana CLI

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.17.34/install)"
```

Add Solana to your PATH (add to `~/.zshrc` or `~/.bash_profile`):

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

Reload your shell configuration:

```bash
source ~/.zshrc  # or source ~/.bash_profile
```

#### 4. Install Anchor CLI

```bash
cargo install --git https://github.com/coral-xyz/anchor --tag v0.29.0 anchor-cli --locked
```

#### 5. Install Node.js and Yarn

Install Node.js using [nvm](https://github.com/nvm-sh/nvm) (recommended):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

Install Yarn:

```bash
npm install -g yarn
```

#### 6. Install GNU tar (Required for MacOS)

MacOS ships with BSD tar, but Anchor requires GNU tar:

```bash
brew install gnu-tar
```

Add GNU tar to your PATH (add to `~/.zshrc` or `~/.bash_profile`):

```bash
export PATH="/opt/homebrew/opt/gnu-tar/libexec/gnubin:$PATH"
```

Reload your shell configuration:

```bash
source ~/.zshrc  # or source ~/.bash_profile
```

#### 7. Install Dependencies

Install root project dependencies:

```bash
yarn install
```

Install SDK dependencies and build:

```bash
cd sdk
yarn install
yarn build-local
cd ..
```

#### 8. Build Programs

Build all Solana programs:

```bash
anchor build
```

Or build a specific program:

```bash
anchor build -p programs
```

#### 9. Run Tests

Run all tests:

```bash
anchor test
```

Run tests without rebuilding (faster for iteration):

```bash
anchor test --skip-build
```

### Troubleshooting

#### "blockstore error" when running tests

If you encounter a "blockstore error", clean up corrupted ledger directories:

```bash
rm -rf .anchor/test-ledger test-ledger
```

Then run `anchor test` again.

#### "Cannot find module" errors

If you see module resolution errors, rebuild the SDK:

```bash
cd sdk
yarn build-local
cd ..
yarn install --force
```

#### Tests timeout or validator doesn't start

Increase the startup wait time in `Anchor.toml`:

```toml
[test]
startup_wait = 10000  # Increase from 5000 if needed
```

## Third-Party Licenses

Approval Notice - Squads v4.0

Solana Program: `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`

Github Repository: [https://github.com/Squads-Protocol/v4](https://github.com/Squads-Protocol/v4) [(97b8ce8)](https://github.com/Squads-Protocol/v4/commit/97b8ce82cc4e52a4ade42412c6c09cb81a20dd99)

We have received confirmation from the original authors and copyright holders of the referenced program that our use of the code complies with the terms of the GNU Affero General Public License v3.0 (AGPLv3).

As confirmed:

- No modifications have been made to the code.
- The program remains publicly available under the AGPLv3 license.
- The copyright holders have no objections to our current use of the program and fully support it.
- This notice is included here for clarity and documentation purposes with the explicit understanding that our use remains within the scope and requirements of the AGPLv3.

If additional information is needed, please contact: [legal@sqds.io](mailto:legal@sqds.io)

Author / Copyright Holder - PGP Message

```
-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA256

b598a2fcb7f64f3b42b1ef180b90d87c725d1e91 
-----BEGIN PGP SIGNATURE-----

iHoEARYIACIbHFNlYW4gR2Fuc2VyIDxzZWFuQHNxZHMuaW8+BQJoo9r2AAoJEBWz
djNpuRaDjZ8BAKBGcZBmZfB4DwJqSf82LQkJBC3aj7fQw9Grs2ejw9dPAPsF8pJJ
EtIuAdgLyTJSCmxjOreQoLK2qp2TnCJVBuQ+CA==
=2LUJ
-----END PGP SIGNATURE-----
```

Author / Copyright Holder Public Key

```
-----BEGIN PGP PUBLIC KEY BLOCK-----

mDMEaKPaQRYJKwYBBAHaRw8BAQdAOFSjz2LK/9ugAK0+PE1xTBd3GkoQMk60my+K
JIz69Eq0GlNlYW4gR2Fuc2VyIDxzZWFuQHNxZHMuaW8+iHIEExYIABoECwkIBwIV
CAIWAQIZAQWCaKPaQQKeAQKbAwAKCRAVs3YzabkWgyeZAQDEsyIPGbuKRwHnLDBl
qiBQVRaV4QPxolLfnqIpyV4ZHwD+NgD/9UQ0nXUYM8tl9tgzwg9+sccxAmp+Lmta
r/dJiwy4OARoo9pBEgorBgEEAZdVAQUBAQdABCgNwp9PQinGsISxKHyPdW1Jb0Bz
Qmbcg/Jfv+e2XBYDAQgHiGEEGBYIAAkFgmij2kECmwwACgkQFbN2M2m5FoMKpgD/
Rd+WIvQBBEDkeXfI2ej5/ubiD2dM58Y0OHMtAY3uFSEBAKlvd/vBMwET9PNK8iHz
Sk3raTvUx9Y+QeJWau4A+NgB
=NWWX
-----END PGP PUBLIC KEY BLOCK-----
```
