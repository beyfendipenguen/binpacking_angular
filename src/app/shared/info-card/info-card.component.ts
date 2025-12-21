import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-info-card',
  imports: [],
  templateUrl: './info-card.component.html',
  styleUrl: './info-card.component.scss',
  standalone: true
})
export class InfoCardComponent {

  @Input() title: string = "Title"
  @Input() header: string = "HEADER"
  @Input() content: string = "CONTENT"
}
