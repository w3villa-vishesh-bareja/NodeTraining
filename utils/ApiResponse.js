class ApiResponse {
  constructor(statusCode, success = true, message, data) {
    {
      this.statusCode = statusCode;
      this.success = success,
      this.message = message || "successful hit",
      this.data = data || [];
    }
  }
}

export default ApiResponse;
