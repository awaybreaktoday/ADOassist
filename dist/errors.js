export class AppError extends Error {
    exitCode;
    constructor(message, exitCode = 1) {
        super(message);
        this.exitCode = exitCode;
        this.name = "AppError";
    }
}
