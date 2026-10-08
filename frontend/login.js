const form = document.getElementById("loginForm");
const email = document.getElementById("email");
const password = document.getElementById("password");
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

function setError(input, errorId, message) {
  document.getElementById(errorId).textContent = message;
  input.classList.toggle("invalid", message !== "");
  return message === "";
}

function showMessage(text, isInfo) {
  successMsg.textContent = text;
  successMsg.classList.toggle("info", !!isInfo);
}

form.addEventListener("submit", async function (e) {
  e.preventDefault();
  showMessage("");

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const okEmail = setError(email, "emailError",
    email.value.trim() === "" ? "Please enter your email."
    : !emailPattern.test(email.value.trim()) ? "Please enter a valid email address." : "");

  const okPass = setError(password, "passwordError",
    password.value === "" ? "Please enter your password."
    : password.value.length < 6 ? "Password must be at least 6 characters." : "");

  if (okEmail && okPass) {
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.value.trim(), password: password.value })
      });
      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("token", data.token);
        window.location.href = "dashboard.html";
      } else {
        showMessage(data.message);
      }
    } catch (error) {
      showMessage("Unable to connect to the server.");
    }
  }
});

// Clear an error as soon as the user edits the field
email.addEventListener("input", function () { setError(email, "emailError", ""); });
password.addEventListener("input", function () { setError(password, "passwordError", ""); });


