(function initStep2Scaffold() {
  const button = document.getElementById("loadStep1Data");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }
  button.addEventListener("click", () => {
    window.alert("Step2 연동은 다음 구현 단계에서 연결됩니다.");
  });
})();
