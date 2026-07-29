import io
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

PALETTE = ["#e8a33d", "#3f8f6f", "#c1503f", "#5b8dd6", "#9b7fd4", "#d4a5c9", "#6fb1a0", "#c98f4f"]


def _make_pie_chart(labels, values, colors_list, title):
    fig, ax = plt.subplots(figsize=(3.2, 3.2))
    if values and sum(values) > 0:
        ax.pie(values, labels=labels, autopct='%1.1f%%', colors=colors_list, textprops={'fontsize': 8})
    else:
        ax.text(0.5, 0.5, "No data", ha='center', va='center')
        ax.axis('off')
    ax.set_title(title, fontsize=10)
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    return buf


def build_review_pdf(user, review) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('TitleCustom', parent=styles['Title'], fontSize=22)
    heading_style = ParagraphStyle('HeadingCustom', parent=styles['Heading2'], spaceBefore=14, spaceAfter=6)
    body_style = styles['BodyText']

    elements = [
        Paragraph("Finance Analysis", title_style),
        Spacer(1, 12),
        Paragraph(f"<b>User:</b> {user.username}", body_style),
        Paragraph(f"<b>Email:</b> {user.email}", body_style),
        Paragraph(
            f"<b>Period:</b> {review.period_label} "
            f"({review.period_start.strftime('%d %b %Y')} - {review.period_end.strftime('%d %b %Y')})",
            body_style,
        ),
        Spacer(1, 16),
    ]

    income_expense_buf = _make_pie_chart(
        ["Income", "Expense"], [review.total_income, review.total_expense],
        ["#3f8f6f", "#c1503f"], "Income vs Expense",
    )
    cat_labels = list(review.category_breakdown.keys())
    cat_values = list(review.category_breakdown.values())
    category_buf = _make_pie_chart(
        cat_labels, cat_values, PALETTE[:len(cat_labels)] if cat_labels else [], "Expense by Category",
    )

    img1 = Image(income_expense_buf, width=8 * cm, height=8 * cm)
    img2 = Image(category_buf, width=8 * cm, height=8 * cm)
    chart_table = Table([[img1, img2]], colWidths=[9 * cm, 9 * cm])
    chart_table.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
    elements.append(chart_table)
    elements.append(Spacer(1, 16))

    elements.append(Paragraph("Expense Review", heading_style))
    elements.append(Paragraph(review.expense_review, body_style))

    elements.append(Paragraph("Income Review", heading_style))
    elements.append(Paragraph(review.income_review, body_style))

    elements.append(Paragraph("Savings & Sustainability Advice", heading_style))
    elements.append(Paragraph(review.savings_advice, body_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer
