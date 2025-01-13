document.getElementById("logoutButton").onclick = function() {
    fetch('/logout')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.location.href = '/';  // Перенаправление на страницу логина
            } else {
                alert("Ошибка при выходе");
            }
        })
        .catch(error => {
            console.error('Ошибка при выходе:', error);
            alert("Ошибка при выходе");
        });
};

