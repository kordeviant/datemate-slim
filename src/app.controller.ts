import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Req,
  Res,
  Version,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from "@nestjs/swagger";
import { Request, Response } from "express";
import { SkipThrottle } from "@nestjs/throttler";
import { AppService } from "./app.service";

@ApiTags("System")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @SkipThrottle()
  @Version([VERSION_NEUTRAL, "1"])
  @Get(["", "health"])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Health check",
    description: "Basic healthcheck endpoint for client connectivity testing.",
  })
  @ApiResponse({
    status: 200,
    description: "Server is healthy",
    schema: {
      example: {
        status: "ok",
      },
    },
  })
  healthCheck() {
    return { status: "ok" };
  }

  @Version([VERSION_NEUTRAL, "1"])
  @Get("time")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Authoritative server time",
    description:
      "Returns current server epoch time in milliseconds for client clock synchronization.",
  })
  @ApiResponse({
    status: 200,
    description: "Current epoch time in milliseconds",
    schema: {
      example: {
        status: "success",
        message: "Operation successful",
        data: 1726830000000,
        error: null,
      },
    },
  })
  getServerTime(): number {
    return Date.now();
  }

  @Version([VERSION_NEUTRAL, "1"])
  @Get(["docs/rules", "rules"])
  @ApiOperation({
    summary: "DateMate Platform Rules & Client Validation Specification",
    description:
      "Authoritative online specification of all client validation rules, media formats, languages, demographics, and schemas. Automatically updated on each backend update. Accessible at /docs/rules or /v1/docs/rules. Supports HTML view (default), JSON (?format=json), Raw Markdown (?format=raw), or file download (?download=1).",
  })
  @ApiQuery({
    name: "format",
    required: false,
    enum: ["html", "json", "raw", "md"],
    description: "Format of the rules document (default: html)",
  })
  @ApiQuery({
    name: "download",
    required: false,
    description: "Pass 1 to download the RULES.md file directly",
  })
  @ApiResponse({
    status: 200,
    description: "Platform rules document in the requested format",
  })
  getRules(
    @Req() req: Request,
    @Res() res: Response,
    @Query("format") format?: string,
    @Query("download") download?: string,
  ) {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const isDownload = download === "1" || download === "true";
    const isRaw =
      format === "raw" ||
      format === "md" ||
      req.headers.accept?.includes("text/markdown");
    const isJson =
      format === "json" ||
      (req.headers.accept?.includes("application/json") &&
        !req.headers.accept?.includes("text/html"));

    if (isDownload) {
      const { content } = this.appService.getRulesMarkdown();
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="DateMate-RULES.md"',
      );
      return res.send(content);
    }

    if (isRaw) {
      const { content } = this.appService.getRulesMarkdown();
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      return res.send(content);
    }

    if (isJson) {
      const data = this.appService.getRulesJson();
      res.setHeader("Content-Type", "application/json");
      return res.json({
        status: "success",
        message: "Operation successful",
        data,
        error: null,
      });
    }

    // Default: Responsive, modern HTML documentation view
    const html = this.appService.getRulesHtml();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  }

  @Version([VERSION_NEUTRAL, "1"])
  @Get(["docs/asyncapi-json", "asyncapi-json"])
  @ApiOperation({
    summary: "AsyncAPI 2.6 Specification JSON",
    description: "Returns the authoritative machine-readable AsyncAPI 2.6 schema for DateMate WebSocket Gateway.",
  })
  @ApiResponse({
    status: 200,
    description: "AsyncAPI JSON specification",
  })
  getAsyncApiJson(@Res() res: Response) {
    const data = this.appService.getAsyncApiJson();
    res.setHeader("Content-Type", "application/json");
    return res.json(data);
  }
}
