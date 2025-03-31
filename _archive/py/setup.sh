#!/bin/bash

# Install Homebrew (if not already installed)
if ! command -v brew &> /dev/null; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install Python3
brew install python3

# Add lines to .zshrc
zshrc_lines=$(cat <<EOF
# dmx
export PATH="/opt/homebrew/bin:\$PATH"
alias python="/opt/homebrew/bin/python3"
alias pip="/opt/homebrew/bin/python3 -m pip"
EOF
)

# Check if the lines are already in .zshrc
if ! grep -q "# dmx" ~/.zshrc; then
  echo "$zshrc_lines" >> ~/.zshrc
  echo "Added dmx settings to ~/.zshrc. Please restart your terminal or run 'source ~/.zshrc'"
else
  echo "dmx settings already present in ~/.zshrc."
fi

# Source .zshrc to apply changes
source ~/.zshrc

# Create and enter virtual environment
python3 -m venv x

source x/bin/activate

pip install pyserial || true

echo "Virtual environment setup complete!"

echo "**Reminder:** Activate the virtual environment with 'source x/bin/activate'"
