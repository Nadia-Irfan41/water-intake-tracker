const form = document.getElementById("registerForm");
const fullName = document.getElementById("fullName");
const email = document.getElementById("email");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const successMsg = document.getElementById("successMsg");

// Show / hide password
document.querySelectorAll(".eye").forEach(function (btn) {
  btn.addEventListener("click", function () {
    const input = document.getElementById(btn.dataset.target);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.classList.toggle("is-visible", show);
    btn.setAttribute("aria-pressed", String(show));
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });
});

// Helpers
function setError(input, errorId, message) {
  document.getElementById(errorId).textContent = message;
  input.classList.toggle("invalid", message !== "");
  return message === "";
}

form.addEventListener("submit", async function (e) {
  e.preventDefault();
  successMsg.textContent = "";

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const okName = setError(
    fullName,
    "nameError",
    fullName.value.trim() === ""
      ? "Please enter your full name."
      : ""
  );

  const okEmail = setError(
    email,
    "emailError",
    email.value.trim() === ""
      ? "Please enter your email."
      : !emailPattern.test(email.value.trim())
      ? "Please enter a valid email address."
      : ""
  );

  const okPass = setError(
    password,
    "passwordError",
    password.value === ""
      ? "Please enter a password."
      : ""
  );

  const okConfirm = setError(
    confirmPassword,
    "confirmError",
    confirmPassword.value === ""
      ? "Please confirm your password."
      : confirmPassword.value !== password.value
      ? "Passwords do not match."
      : ""
  );

  if (!(okName && okEmail && okPass && okConfirm)) {
    return;
  }

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: fullName.value.trim(),
        email: email.value.trim(),
        password: password.value
      })
    });

    const data = await response.json();

    if (response.ok) {
      successMsg.textContent = "Account created successfully!";

      form.reset();

      setTimeout(function () {
        window.location.href = "login.html";
      }, 1500);

    } else {
      successMsg.textContent = data.message;
    }

  } catch (error) {
    console.error("Registration error:", error);
    successMsg.textContent =
      "Unable to connect to the server.";
  }
});

document.getElementById("loginLink").setAttribute("href", "login.html");

